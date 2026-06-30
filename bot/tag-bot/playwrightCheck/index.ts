import {
  Browser, BrowserContext, Page, chromium,
} from 'playwright';
import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi from '../../wiki/WikiApi';

export type PlaywrightLinkCheckRequestLink = {
  link: string;
  text: string;
};

export type PlaywrightLinkCheckResult = PlaywrightLinkCheckRequestLink & {
  ok: boolean;
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

const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

async function checkLink(page: Page, link: PlaywrightLinkCheckRequestLink): Promise<PlaywrightLinkCheckResult> {
  try {
    const response = await page.goto(link.link, {
      waitUntil: 'domcontentloaded',
      timeout: 30 * 1000,
    });
    return {
      ...link,
      ok: response?.ok() ?? false,
      status: response?.status() ?? 0,
      statusText: response?.statusText() ?? '',
    };
  } catch (error) {
    return {
      ...link,
      ok: false,
      status: 0,
      statusText: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runLinkChecks(links: PlaywrightLinkCheckRequestLink[]): Promise<PlaywrightLinkCheckResponse> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext({ userAgent });
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

export async function handleQueueMessage(api: ReturnType<typeof WikiApi>, body: string) {
  const message = JSON.parse(body) as PlaywrightLinkCheckRequest;
  const results = await runLinkChecks(message.links ?? []);
  const failed = results.results.filter((result) => !result.ok);
  const content = failed.length === 0
    ? 'כל הקישורים שנבדקו ברקע תקינים'
    : `קישורים שנכשלו בבדיקה ברקע:\n${failed.map((link) => `* [${link.link} ${link.text}], ${link.error ?? `לא ניתן להגיע לקישור - ${link.status} - ${link.statusText}`}`).join('\n')}`;

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
