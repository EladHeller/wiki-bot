import {
  Browser, BrowserContext, Page, chromium,
} from 'playwright';

const mainUrl = 'https://infogram.com/1p9y2l3j2l2vj2t75zmgg9d11pb3q31pw0x';
const KidnappedUrl = 'https://infogram.com/shay-tvh-h-7-vvktvvr-1hxj48pxm3k5q2v';

// חטופים בשבי
const kidnappetInGaza = 'חטופים שנותרו בשבי';
const releasedKidnapped = 'שוחררו או חולצו';

const urlDict = {
  [mainUrl]: { titles: ['הרוגים ישראלים', 'פצועים בעזה (ע"פ חמאס)', 'הרוגים בעזה (ע"פ חמאס)', kidnappetInGaza], numberUp: false, page: 1 },
  [`${mainUrl}#`]: { titles: ['הרוגים פלסטינים באיו"ש', 'עצורים פלסטינים**'], numberUp: false, page: 5 },
  [`${mainUrl}#1`]: { titles: ['הרוגים בלבנון'], numberUp: false, page: 3 },
  [KidnappedUrl]: { titles: [releasedKidnapped], numberUp: true, page: 1 },
};

async function getPanelData(page: Page, titles: string[], numberUp = false) {
  return page.evaluate((config) => {
    const textsToRemove = ['מעל ל-', 'כ-'];
    const blocks = Array.from(globalThis.document.querySelectorAll('.public-DraftStyleDefault-block'));
    const data = config.titles.reduce((acc, key) => {
      const elements = blocks.filter((counter) => {
        const text = counter.textContent?.trim();
        return text === key;
      });
      if (elements.length > 1) {
        throw new Error(`Multiple blocks with title ${key}`);
      }
      if (elements.length === 0) {
        throw new Error(`No blocks with title ${key}`);
      }
      const element = elements[0];
      const elementRect = element.getBoundingClientRect();
      const relatedElements = blocks.filter((block) => {
        if (block === element) {
          return false;
        }

        const blockRect = block.getBoundingClientRect();
        const horizontalOverlapSize = Math.min(elementRect.right, blockRect.right)
        - Math.max(elementRect.left, blockRect.left);
        return (config.numberUp
          ? (elementRect.top - 40 < blockRect.bottom && elementRect.top > blockRect.top)
          : (blockRect.top - 40 < elementRect.bottom && blockRect.top > elementRect.top))
        // && elementRect.left < blockRect.right && elementRect.right > blockRect.left
        && elementRect.width * 0.7 < horizontalOverlapSize;
      });
      const numberElements = relatedElements.filter((block) => {
        let text = block.textContent?.trim();
        for (const textToRemove of textsToRemove) {
          text = text?.replace(textToRemove, '');
        }
        return text?.match(/^(\d{1,9},?)+$/)?.[0];
      });
      if (numberElements.length > 1) {
        throw new Error(`Multiple number elements related to ${key}: ${numberElements.map((el) => el.textContent ?? '').join(', ')}`);
      } else if (numberElements.length === 0) {
        throw new Error(`No number elements related to ${key}`);
      }
      let text = numberElements[0].textContent?.trim();
      for (const textToRemove of textsToRemove) {
        text = text?.replace(textToRemove, '');
      }
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
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: 10 * 1000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

    });
    page = await context.newPage();
    let result = {};
    await page.goto(mainUrl);
    const elementsWithInjuriesText = await page.getByText('נפגעים').all();

    for (const element of elementsWithInjuriesText) {
      const text = await element.textContent();
      // 23,907 פצועים
      if (text?.match(/^\d{1,3},\d{3} נפגעים$/)) {
        const number = parseInt(text.replace(/,/g, '').split(' ')[0], 10);
        result = { ...result, פצועים: number };
      }
    }

    for (const [url, config] of Object.entries(urlDict)) {
      await page.goto('about:blank');
      await page.goto(url);
      await page.waitForSelector('.public-DraftStyleDefault-block');
      for (let i = 1; i < config.page; i += 1) {
        await page.click('[aria-label="Next page"],[aria-label="Next slide"]');
        await page.waitForTimeout(200);
      }

      const currResults = await getPanelData(page, config.titles, config.numberUp);
      result = { ...result, ...currResults };
    }
    if (result[kidnappetInGaza]) {
      result[kidnappetInGaza] -= 1; // 1 kidnapped before the war
    }
    if (result[releasedKidnapped]) {
      result[releasedKidnapped] -= 3; // 3 of the released were kidnapped before the war
    }
    return result;
  } finally {
    await page?.close();
    await context?.close();
    await browser?.close();
  }
}
