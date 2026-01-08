import { JSDOM } from 'jsdom';
import { WikiPage } from '../types';
import { logger } from '../utilities/logger';

function getTextNodeByText(textNodes: Text[], label: string): Text | undefined {
  return textNodes.find((textNode) => textNode.textContent?.trim().toUpperCase() === label);
}

export const googleFinanceRegex = /^https:\/\/www\.google\.com\/finance\?q=([0-9A-Za-z.\-:_]+)$/;

const numberSignToHebrewNumber = {
  K: '1000 (מספר)|אלף',
  M: 'מיליון',
  B: 'מיליארד',
  T: 'טריליון',
};

export interface MarketCap {
  number: string;
  currency: string;
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

function textToMarketCao(marketCap: string): MarketCap {
  const matches = marketCap.match(/(\d{1,3}(?:\.\d{1,2}))(\w) (\w+)/);
  if (!matches?.[1]) {
    return {
      number: '0',
      currency: 'USD',
    };
  }
  const num = matches[1];
  const numberName = matches[2];
  return {
    number: `${num}${(numberName && numberSignToHebrewNumber[numberName]) ? ` [[${numberSignToHebrewNumber[numberName]}]]` : ''}`,
    currency: matches[3],
  };
}

export default async function getStockData(
  googleFinanceUrl: string,
): Promise<GoogleFinanceData | null> {
  const dom = await JSDOM.fromURL(googleFinanceUrl);
  const { document } = dom.window;
  const mainElement = document.querySelector('main');
  if (!mainElement) {
    return null;
  }

  const treeWalker = document.createTreeWalker(mainElement, 4);
  const textNodes: Text[] = [];
  let textNode = treeWalker.nextNode();
  while (textNode != null) {
    textNodes.push(textNode as Text);
    textNode = treeWalker.nextNode();
  }
  const marketCapLabel = getTextNodeByText(textNodes, 'MARKET CAP');
  const marketCap = marketCapLabel
    ?.parentElement?.parentElement?.parentElement?.lastChild?.textContent ?? undefined;

  const dateString = getTextNodeByText(textNodes, 'CLOSED:')?.nextSibling?.textContent;

  const now = new Date();
  const date = dateString ? new Date(dateString) : now;
  if (date > now) {
    date.setFullYear(date.getFullYear() - 1);
  }
  return {
    marketCap: { ...textToMarketCao(marketCap ?? ''), date: date.toJSON() },
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
    let res = await getStockData(extLink);
    if (!res || res.marketCap.number === '0') {
      res = await getStockData(`${extLink}:NASDAQ`);
    }
    if (!res || res.marketCap.number === '0') {
      res = await getStockData(`${extLink}:NYSE`);
    }
    if (!res || res.marketCap.number === '0') {
      res = await getStockData(`${base}/quote/${ticker}:NASDAQ`);
    }
    if (!res || res.marketCap.number === '0') {
      res = await getStockData(`${base}/quote/${ticker}:NYSE`);
    }
    if (res?.marketCap.number === '0') {
      console.log('equal zero', page.title);
      return undefined;
    }
    if (res) {
      return {
        gf: res,
        ticker,
        wiki: page,
      };
    }
    console.log('no results', page.title);
  } catch (e) {
    logger.logError(`${page.title}: ${e}`);
  }
  return undefined;
}
