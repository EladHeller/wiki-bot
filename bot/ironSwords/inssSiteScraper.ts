import * as playwright from 'playwright-aws-lambda';
import { Browser, Page } from 'playwright-core';

const urlDict = {
  'https://infogram.com/1p9y2l3j2l2vj2t75zmgg9d11pb3q31pw0x': { titles: ['הרוגים ישראלים'], numberUp: false },
  'https://infogram.com/shay-tvh-h-7-vvktvvr-1hxj48pxm3k5q2v': { titles: ['סך החטופים ההרוגים'], numberUp: true },
};

async function getPanelData(page: Page, titles: string[], numberUp = false) {
  return page.evaluate((config) => {
    const blocks = Array.from(globalThis.document.querySelectorAll('.public-DraftStyleDefault-block '));
    const data = config.titles.reduce((acc, key) => {
      const elements = blocks.filter((counter) => {
        const text = counter.textContent?.trim();
        return text === key;
      });
      if (elements.length > 1) {
        throw new Error(`Multiple blocks with title ${key}`);
      }
      const element = elements[0];
      const elementRects = element.getClientRects();
      const relatedElements = blocks.filter((block) => {
        if (block === element) {
          return false;
        }

        const blockRects = block.getClientRects();
        return (config.numberUp
          ? (elementRects[0].top - 40 < blockRects[0].bottom)
          : (elementRects[0].bottom < blockRects[0].top && blockRects[0].top - 40 < elementRects[0].bottom))
        && elementRects[0].left < blockRects[0].right && elementRects[0].right > blockRects[0].left;
      });
      const numberElements = relatedElements.filter((block) => {
        const text = block.textContent?.trim();
        return text?.match(/^(\d+,?)+$/)?.[0];
      });
      if (numberElements.length > 1) {
        throw new Error(`Multiple number elements related to ${key}`);
      } else if (numberElements.length === 0) {
        throw new Error(`No number elements related to ${key}`);
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
  }, { titles, numberUp });
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
    let result = {};
    for (const [url, config] of Object.entries(urlDict)) {
      await page.goto(url);
      await page.waitForSelector('.public-DraftStyleDefault-block');
      const currResults = await getPanelData(page, config.titles, config.numberUp);
      result = { ...result, ...currResults };
    }
    return result;
  } finally {
    await browser?.close();
  }
}
