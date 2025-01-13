import 'dotenv/config';
import * as playwright from 'playwright-aws-lambda';
import { ChromiumBrowser, Page } from 'playwright-core';

export async function main() {
  let page: Page;
  let browser: ChromiumBrowser;

  try {
    browser = await playwright.launchChromium({
      headless: false,
      timeout: 10 * 1000,
    });
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto('https://www.idf.il/אתרי-יחידות/יומן-המלחמה/חללי-ופצועי-צה-ל-במלחמה/');
    const content = await page.content();
    console.log(content);
    await browser.close();
  } catch (e) {
    console.error(e);
  }
}

export default main;
