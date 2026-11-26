import { Browser, chromium } from 'playwright';
import { logger } from './logger';
import getChromiumLaunchOptions from './playwright';

export default function createUrlRedirectChecker(urlRegex: RegExp) {
  let browser: Browser | undefined;

  async function resolveGoogleUrl(url: string) {
    browser ??= await chromium.launch(getChromiumLaunchOptions());
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForURL(
        (target) => target.hostname === 'walla.co.il' || target.hostname.endsWith('.walla.co.il'),
        { waitUntil: 'domcontentloaded', timeout: 30000 },
      );
      return page.url();
    } finally {
      await page.close();
    }
  }

  async function checkUrlRedirect(url: string) {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (response.status >= 400) {
      return url;
    }
    if (response.url.match(urlRegex)) {
      return response.url;
    }
    const target = new URL(response.url);
    if (!['google.com', 'www.google.com'].includes(target.hostname) || target.pathname !== '/goto') {
      return url;
    }
    try {
      const resolvedUrl = await resolveGoogleUrl(response.url);
      return resolvedUrl.match(urlRegex) ? resolvedUrl : url;
    } catch (error) {
      logger.logError(`Failed to resolve Google URL ${url}: ${error.message}`);
      return url;
    }
  }

  async function closeBrowser() {
    await browser?.close();
    browser = undefined;
  }

  return { checkUrlRedirect, closeBrowser };
}
