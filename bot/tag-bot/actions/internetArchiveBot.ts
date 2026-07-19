import { getExternalLinkUserAgent, LinkCheckState } from './externalLinkChecker';

type IABotUrlRecord = {
  url?: string;
  normalizedurl?: string;
  accesstime?: string;
  live_state?: string;
};

type IABotResponse = {
  urls?: Record<string, IABotUrlRecord>;
};

type IABotDependencies = {
  fetchFn: typeof fetch;
  now: () => number;
};

const IABOT_API_URL = 'https://iabot.wmcloud.org/api.php';
const REQUEST_TIMEOUT_MS = 15 * 1000;
const MAX_RESULT_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 60 * 1000;

const resultCache = new Map<string, { state: LinkCheckState; expiresAt: number }>();

const defaultDependencies: IABotDependencies = {
  fetchFn: fetch,
  now: Date.now,
};

function normalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function isFresh(record: IABotUrlRecord, now: number): boolean {
  if (record.live_state === 'whitelisted' || record.live_state === 'blacklisted') {
    return true;
  }
  if (!record.accesstime) {
    return false;
  }
  const accessTime = Date.parse(`${record.accesstime}Z`);
  return !Number.isNaN(accessTime) && now - accessTime <= MAX_RESULT_AGE_MS;
}

function mapState(record: IABotUrlRecord, now: number): LinkCheckState {
  if (!isFresh(record, now)) {
    return 'unknown';
  }
  switch (record.live_state) {
  case 'alive':
  case 'whitelisted':
    return 'alive';
  case 'dead':
  case 'blacklisted':
    return 'dead';
  case 'dying':
    return 'transient';
  case 'paywall':
    return 'blocked';
  default:
    return 'unknown';
  }
}

export async function lookupIABotLinks(
  urls: string[],
  dependencyOverrides: Partial<IABotDependencies> = {},
): Promise<Map<string, LinkCheckState>> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const uniqueUrls = [...new Set(urls)];
  const results = new Map<string, LinkCheckState>();
  const uncachedUrls = uniqueUrls.filter((url) => {
    const cached = resultCache.get(normalizeUrl(url));
    if (cached && cached.expiresAt > dependencies.now()) {
      results.set(url, cached.state);
      return false;
    }
    return true;
  });
  if (uncachedUrls.length === 0) {
    return results;
  }
  const body = new URLSearchParams({
    action: 'searchurldata',
    wiki: 'hewiki',
    urls: uncachedUrls.join('\n'),
  });
  const response = await dependencies.fetchFn(IABOT_API_URL, {
    method: 'POST',
    headers: {
      'User-Agent': getExternalLinkUserAgent(),
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    if (response.body) {
      await Promise.allSettled([response.body.cancel()]);
    }
    throw new Error(`IABot returned ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as IABotResponse;
  const records = Object.values(data.urls ?? {});
  uncachedUrls.forEach((url) => {
    const normalized = normalizeUrl(url);
    const record = records.find((candidate) => candidate.url === url
      || candidate.normalizedurl === url
      || normalizeUrl(candidate.url ?? '') === normalized
      || normalizeUrl(candidate.normalizedurl ?? '') === normalized);
    const state = record ? mapState(record, dependencies.now()) : 'unknown';
    results.set(url, state);
    resultCache.set(normalized, { state, expiresAt: dependencies.now() + CACHE_TTL_MS });
  });
  return results;
}

export function clearIABotCache(): void {
  resultCache.clear();
}
