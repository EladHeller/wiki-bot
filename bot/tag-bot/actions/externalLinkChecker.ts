import { setTimeout as sleep } from 'node:timers/promises';
import { WikiLink } from '../../wiki/wikiLinkParser';

export type LinkCheckState = 'alive' | 'dead' | 'blocked' | 'transient' | 'unknown';

export type LinkCheckResult = {
  state: LinkCheckState;
  status?: number;
  statusText?: string;
  error?: string;
};

type LinkCheckerDependencies = {
  fetchFn: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
};

const HOST_INTERVAL_MS = 1000;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const TRANSIENT_CACHE_TTL_MS = 60 * 1000;
const MAX_RESPONSE_SAMPLE_BYTES = 32 * 1024;

const resultCache = new Map<string, { result: LinkCheckResult; expiresAt: number }>();
const hostNextRequestAt = new Map<string, number>();

const defaultDependencies: LinkCheckerDependencies = {
  fetchFn: fetch,
  sleep,
  now: Date.now,
};

export function getExternalLinkUserAgent(): string {
  const botName = process.env.BOT_NAME ?? 'Sapper-bot';
  const wikiBaseUrl = (process.env.BASE_URL ?? 'https://he.wikipedia.org').replace(/\/$/, '');
  return `${botName}/1.0 (${wikiBaseUrl}/wiki/User:${botName})`;
}

function getReferrer(pageTitle?: string): string | undefined {
  if (!pageTitle) {
    return undefined;
  }
  const wikiBaseUrl = (process.env.BASE_URL ?? 'https://he.wikipedia.org').replace(/\/$/, '');
  return `${wikiBaseUrl}/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
}

export function classifyLinkStatus(status: number): LinkCheckState {
  if (status >= 200 && status < 400) {
    return 'alive';
  }
  if (status === 404 || status === 410) {
    return 'dead';
  }
  if ([401, 403, 407, 429, 451].includes(status)) {
    return 'blocked';
  }
  if ([408, 425].includes(status) || status >= 500) {
    return 'transient';
  }
  return 'unknown';
}

async function readResponseSample(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < MAX_RESPONSE_SAMPLE_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) {
        break;
      }
      const remaining = MAX_RESPONSE_SAMPLE_BYTES - received;
      chunks.push(value.subarray(0, remaining));
      received += Math.min(value.length, remaining);
    }
  } finally {
    await Promise.allSettled([reader.cancel()]);
  }
  const sample = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    sample.set(chunk, offset);
    offset += chunk.length;
  });
  return new TextDecoder().decode(sample);
}

function isChallengeResponse(response: Response, bodySample: string): boolean {
  const { headers } = response;
  const server = headers.get('server')?.toLowerCase() ?? '';
  const mitigated = headers.get('cf-mitigated')?.toLowerCase() ?? '';
  return mitigated === 'challenge'
    || (response.status === 403 && server.includes('cloudflare'))
    || /cf-chl-|just a moment|captcha|incapsula|akamai|access denied/i.test(bodySample);
}

async function classifyResponse(response: Response): Promise<LinkCheckResult> {
  let state = classifyLinkStatus(response.status);
  if ([403, 429, 503].includes(response.status)) {
    const bodySample = await readResponseSample(response);
    if (isChallengeResponse(response, bodySample)) {
      state = 'blocked';
    }
  } else if (response.body) {
    await Promise.allSettled([response.body.cancel()]);
  }
  return {
    state,
    status: response.status,
    statusText: response.statusText,
  };
}

function getRetryDelay(response: Response | undefined): number {
  const retryAfter = response?.headers?.get('retry-after');
  if (!retryAfter) {
    return RETRY_DELAY_MS;
  }
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(seconds * 1000, RETRY_DELAY_MS), 5000);
  }
  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? RETRY_DELAY_MS : Math.min(Math.max(date - Date.now(), RETRY_DELAY_MS), 5000);
}

function shouldRetry(result: LinkCheckResult): boolean {
  return result.state === 'dead'
    || result.state === 'transient'
    || result.status === 429;
}

async function waitForHost(url: string, dependencies: LinkCheckerDependencies): Promise<void> {
  const host = new URL(url).hostname;
  const nextRequestAt = hostNextRequestAt.get(host) ?? 0;
  const delay = nextRequestAt - dependencies.now();
  if (delay > 0) {
    await dependencies.sleep(delay);
  }
  hostNextRequestAt.set(host, dependencies.now() + HOST_INTERVAL_MS);
}

async function requestLink(
  url: string,
  pageTitle: string | undefined,
  dependencies: LinkCheckerDependencies,
): Promise<{ result: LinkCheckResult; response?: Response }> {
  await waitForHost(url, dependencies);
  let response: Response | undefined;
  try {
    const referrer = getReferrer(pageTitle);
    response = await dependencies.fetchFn(url, {
      headers: {
        'User-Agent': getExternalLinkUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.7',
        ...(referrer ? { Referer: referrer } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { result: await classifyResponse(response), response };
  } catch (error) {
    return {
      result: {
        state: 'transient',
        error: error instanceof Error ? error.message : String(error),
      },
      response,
    };
  }
}

async function checkLink(
  url: string,
  pageTitle: string | undefined,
  dependencies: LinkCheckerDependencies,
): Promise<LinkCheckResult> {
  const cached = resultCache.get(url);
  if (cached && cached.expiresAt > dependencies.now()) {
    return cached.result;
  }
  const initialCheck = await requestLink(url, pageTitle, dependencies);
  const { response } = initialCheck;
  let { result } = initialCheck;
  if (shouldRetry(result)) {
    await dependencies.sleep(getRetryDelay(response));
    ({ result } = await requestLink(url, pageTitle, dependencies));
  }
  const ttl = result.state === 'transient' ? TRANSIENT_CACHE_TTL_MS : CACHE_TTL_MS;
  resultCache.set(url, { result, expiresAt: dependencies.now() + ttl });
  return result;
}

export async function checkLinksWithHttp(
  links: WikiLink[],
  pageTitle?: string,
  dependencyOverrides: Partial<LinkCheckerDependencies> = {},
): Promise<Map<string, LinkCheckResult>> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const uniqueUrls = [...new Set(links.map((link) => link.link))];
  const results = new Map<string, LinkCheckResult>();
  for (const url of uniqueUrls) {
    results.set(url, await checkLink(url, pageTitle, dependencies));
  }
  return results;
}

export function clearLinkCheckCache(): void {
  resultCache.clear();
  hostNextRequestAt.clear();
}
