import {
  Browser, BrowserContext, Page, Response as PlaywrightResponse, chromium,
} from 'playwright';
import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import { classifyLinkStatus, LinkCheckState } from '../actions/externalLinkChecker';

export type PlaywrightLinkCheckRequestLink = {
  link: string;
  text: string;
};

export type PlaywrightLinkCheckResult = PlaywrightLinkCheckRequestLink & {
  ok: boolean;
  state: LinkCheckState;
  status: number;
  statusText: string;
  error?: string;
};

export type PlaywrightLinkCheckRequest = {
  links?: PlaywrightLinkCheckRequestLink[];
  title?: string;
  commentSummary?: string;
  commentId?: string;
};

export type PlaywrightLinkCheckResponse = {
  results: PlaywrightLinkCheckResult[];
};

type SqsEvent = {
  Records?: {
    body?: string;
  }[];
};

const launchOptions = {
  headless: true,
  timeout: 30 * 1000,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    '--no-zygote',
  ],
};

const navigationOptions = {
  waitUntil: 'domcontentloaded' as const,
  timeout: 30 * 1000,
};

const challengeStatuses = [403, 429, 503];

async function hasChallengePage(page: Page): Promise<boolean> {
  const [title, content] = await Promise.allSettled([page.title(), page.content()]);
  const titleText = title.status === 'fulfilled' ? title.value : '';
  const contentText = content.status === 'fulfilled' ? content.value : '';
  return /cf-chl-|just a moment|captcha|incapsula|akamai|access denied/i.test(`${titleText}\n${contentText}`);
}

async function retryChallengeResponse(
  page: Page,
  response: PlaywrightResponse,
): Promise<PlaywrightResponse> {
  if (!challengeStatuses.includes(response.status())) {
    return response;
  }
  await page.waitForTimeout(5000);
  try {
    return await page.reload(navigationOptions) ?? response;
  } catch {
    return response;
  }
}

async function checkLink(page: Page, link: PlaywrightLinkCheckRequestLink): Promise<PlaywrightLinkCheckResult> {
  try {
    const initialResponse = await page.goto(link.link, navigationOptions);
    const response = initialResponse ? await retryChallengeResponse(page, initialResponse) : null;
    const status = response?.status() ?? 0;
    let state = response ? classifyLinkStatus(status) : 'unknown';
    if (response && challengeStatuses.includes(status) && await hasChallengePage(page)) {
      state = 'blocked';
    }
    return {
      ...link,
      ok: state === 'alive',
      state,
      status,
      statusText: response?.statusText() ?? '',
    };
  } catch (error) {
    return {
      ...link,
      ok: false,
      state: 'transient',
      status: 0,
      statusText: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runLinkChecks(links: PlaywrightLinkCheckRequestLink[]): Promise<PlaywrightLinkCheckResponse> {
  if (links.length === 0) {
    return { results: [] };
  }
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({
      locale: 'he-IL',
      timezoneId: 'Asia/Jerusalem',
      viewport: { width: 1280, height: 720 },
      extraHTTPHeaders: {
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.7',
      },
    });
    const results: PlaywrightLinkCheckResult[] = [];

    for (const link of links) {
      const page = await context.newPage();
      try {
        results.push(await checkLink(page, link));
      } finally {
        await page.close();
      }
    }

    return { results };
  } finally {
    await context?.close();
    await browser?.close();
  }
}

export async function handleQueueMessage(api: IWikiApi, body: string) {
  const message = JSON.parse(body) as PlaywrightLinkCheckRequest;
  const results = await runLinkChecks(message.links ?? []);
  const dead = results.results.filter((result) => result.state === 'dead');
  const unresolved = results.results.filter((result) => !['alive', 'dead'].includes(result.state));
  const sections: string[] = [];
  if (dead.length > 0) {
    sections.push(`קישורים שבורים בבדיקה ברקע:\n${dead.map((link) => `* [${link.link} ${link.text}], לא ניתן להגיע לקישור - ${link.status} - ${link.statusText}`).join('\n')}`);
  }
  if (unresolved.length > 0) {
    sections.push(`קישורים שלא ניתן היה לאמת בבדיקה ברקע:\n${unresolved.map((link) => `* [${link.link} ${link.text}], ${link.error ?? `לא ניתן לאמת את הקישור - ${link.status} - ${link.statusText}`}`).join('\n')}`);
  }
  const content = sections.length === 0 ? 'כל הקישורים שנבדקו ברקע תקינים' : sections.join('\n');

  if (message.title && message.commentSummary && message.commentId) {
    await api.addComment(message.title, message.commentSummary, content, message.commentId);
  }
}

export async function handleEvent(event: SqsEvent): Promise<void> {
  const api = WikiApi();
  await api.login();
  const records = event.Records ?? [];
  for (const record of records) {
    if (record.body) {
      await handleQueueMessage(api, record.body);
    }
  }
}

export default async function playwrightCheck(event: SqsEvent): Promise<void> {
  await handleEvent(event);
}

export const main = botLoggerDecorator(playwrightCheck, { botName: 'בוט בדיקת קישורים' });
