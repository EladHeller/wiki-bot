import * as playwright from 'playwright-aws-lambda';
import { Browser, Page } from 'playwright-core';

const url = 'https://infogram.com/1p9y2l3j2l2vj2t75zmgg9d11pb3q31pw0x';

async function getPanelData(page: Page, titles: string[]) {
  return page.evaluate((keys) => {
    const blocks = Array.from(globalThis.document.querySelectorAll('.public-DraftStyleDefault-block '));
    const data = keys.reduce((acc, key) => {
      const elements = blocks.filter((counter) => {
        const text = counter.textContent?.trim();
        return text === key;
      });
      if (elements.length > 1) {
        throw new Error(`Multiple blocks with title ${key}`);
      }
      const element = elements[0];
      const elementRects = element.getClientRects();
      const underElements = blocks.filter((block) => {
        if (block === element) {
          return false;
        }

        const blockRects = block.getClientRects();
        return elementRects[0].bottom < blockRects[0].top && blockRects[0].top - 40 < elementRects[0].bottom
        && elementRects[0].left < blockRects[0].right && elementRects[0].right > blockRects[0].left;
      });
      const numberElements = underElements.filter((block) => {
        const text = block.textContent?.trim();
        return text?.match(/^(\d+,?)+$/)?.[0];
      });
      if (numberElements.length > 1) {
        throw new Error(`Multiple number elements under ${key}`);
      } else if (numberElements.length === 0) {
        throw new Error(`No number elements under ${key}`);
      }
      const text = numberElements[0].textContent;
      const number = parseInt(text?.replace(/,/g, '') ?? '', 10);
      if (Number.isNaN(number)) {
        throw new Error(`Invalid number ${text}`);
      }
      return {
        ...acc,
        [key]: number,
      };
    }, {});
    return data;
  }, titles);
}

export default async function getWarData() {
  let browser: Browser | null = null;
  try {
    browser = await playwright.launchChromium({
      headless: false,
      timeout: 10 * 1000,
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

    });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForSelector('.public-DraftStyleDefault-block');

    const result = await getPanelData(page, ['הרוגים ישראלים']);
    return result;
  } finally {
    await browser?.close();
  }
}
