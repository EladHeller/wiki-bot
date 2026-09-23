import { JSDOM } from 'jsdom';
import { WikiPage } from '../types';
import { logger, stringify } from '../utilities/logger';
import { CurrencyCode, currencyName } from '../utilities';

export const googleFinanceRegex = /^https:\/\/www\.google\.com\/finance\?q=([0-9A-Za-z.\-:_]+)$/;

const numberSignToHebrewNumber = {
  K: '1000 (מספר)|אלף',
  M: 'מיליון',
  B: 'מיליארד',
  T: 'טריליון',
};

export interface MarketCap {
  number: string;
  currency: CurrencyCode;
  date?: string;
}

export interface GoogleFinanceData {
  marketCap: MarketCap;
}

export interface WikiPageWithGoogleFinance {
  gf: GoogleFinanceData;
  wiki: WikiPage;
  ticker: string;
}

function isCurrency(str: string): str is CurrencyCode {
  return Object.keys(currencyName).includes(str);
}

function isNumberName(str: string): str is keyof typeof numberSignToHebrewNumber {
  return Object.keys(numberSignToHebrewNumber).includes(str);
}

function textToMarketCap(marketCap: string): MarketCap | null {
  const matches = marketCap.trim().match(/^(\d+(?:\.\d+)?)([A-Z])\s+([A-Z]{3})$/);
  if (!matches) {
    return null;
  }
  const num = matches[1];
  const numberName = matches[2];
  const currencyCode = matches[3];
  if (!isCurrency(currencyCode) || !isNumberName(numberName) || Number(num) <= 0) {
    return null;
  }
  return {
    number: `${num} [[${numberSignToHebrewNumber[numberName]}]]`,
    currency: currencyCode,
  };
}

export default async function getStockData(
  googleFinanceUrl: string,
): Promise<GoogleFinanceData | null> {
  const url = new URL(googleFinanceUrl);
  url.searchParams.set('hl', 'en');
  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Google Finance HTTP ${response.status}: ${url}`);
  }
  const dom = await response.text();
  const { document } = new JSDOM(dom.replace(/<style[^>]*>[^<]*<\/style>/g, '')).window;
  const mainElement = document.querySelector('main');
  if (!mainElement) {
    throw new Error(`Google Finance returned no main element (${document.title}): ${url}`);
  }

  const treeWalker = document.createTreeWalker(mainElement, 4);
  const textNodes: Text[] = [];
  let textNode = treeWalker.nextNode();
  while (textNode != null) {
    textNodes.push(textNode as Text);
    textNode = treeWalker.nextNode();
  }
  const quoteTime = textNodes.map((node) => node.textContent as string)
    .find((text) => /\s·\s+[A-Z]{3}\s*$/.test(text)) ?? '';
  const currency = quoteTime.match(/\b([A-Z]{3})\s*$/)?.[1] ?? '';
  const marketCapLabel = textNodes.find((node) => /^(market cap|mkt\. cap)$/i.test(node.textContent.trim()));
  let marketCapElement = marketCapLabel?.parentElement ?? null;
  let marketCapData: MarketCap | null = null;
  while (marketCapElement && marketCapElement !== mainElement && !marketCapData) {
    const value = marketCapElement.lastElementChild?.textContent ?? '';
    marketCapData = textToMarketCap(value) ?? textToMarketCap(`${value} ${currency}`);
    marketCapElement = marketCapElement.parentElement;
  }
  if (!marketCapData) {
    return null;
  }
  const closedNode = textNodes.find((node) => /^Closed:/i.test(node.textContent.trim()));
  const dateString = closedNode
    ? `${closedNode.textContent} ${closedNode.nextSibling?.textContent ?? ''}`
      .replace(/^Closed:\s*/i, '').split('·')[0].trim().replace(/\s+/g, ' ')
    : '';
  const now = new Date();
  const date = dateString
    ? new Date(dateString.replace(/^([A-Za-z]{3} \d{1,2}), (?=\d{1,2}:)/, `$1, ${now.getFullYear()} `))
    : now;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Google Finance returned an invalid close date: ${dateString}`);
  }
  if (date > now) {
    date.setFullYear(date.getFullYear() - 1);
  }
  return {
    marketCap: { ...marketCapData, date: date.toJSON() },
  };
}

export async function currencyExchange(from: string, to: string): Promise<number> {
  const dom = await JSDOM.fromURL(`https://www.google.com/finance/quote/${from}-${to}`);
  const prevClose = dom.window.document.querySelector('main [role="region"] > div > div');
  return Number(prevClose?.textContent?.replace(/,/g, '') ?? 0);
}

export function getTickerFromWikiPage(page: WikiPage): string | undefined {
  const extLink = page.extlinks?.find((link) => link['*'].match(googleFinanceRegex))?.['*'];
  if (!extLink) {
    return undefined;
  }
  return extLink.split('?q=')[1];
}

export async function getCompanyData(
  page: WikiPage,
): Promise<WikiPageWithGoogleFinance | undefined> {
  const extLink = page.extlinks?.find((link) => link['*'].match(googleFinanceRegex))?.['*'];
  if (!extLink) {
    console.log('no extLink', page.title, extLink);
    return undefined;
  }
  const [base, ticker] = extLink.split('?q=');
  try {
    const urls = [
      extLink,
      `${extLink}:NASDAQ`,
      `${extLink}:NYSE`,
      `${base}/quote/${ticker}:NASDAQ`,
      `${base}/quote/${ticker}:NYSE`,
    ];
    for (const url of urls) {
      const res = await getStockData(url);
      if (res) {
        return { gf: res, ticker, wiki: page };
      }
    }
    console.warn(`No market cap found for ${page.title} (${ticker})`);
  } catch (e) {
    logger.logError(`${page.title}: ${stringify(e)}`);
  }
  return undefined;
}
