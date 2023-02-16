import { JSDOM } from 'jsdom';

function getTextNodeByText(textNodes: Text[], label: string): Text | undefined {
  return textNodes.find((textNode) => textNode.textContent?.trim().toUpperCase() === label);
}

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
    number: `${num}${numberName ? ` [[${numberSignToHebrewNumber[matches[2]]}]]` : ''}`,
    currency: matches[3],
  };
}

export default async function getStockData(
  googleFinanceUrl: string,
): Promise<GoogleFinanceData | null> {
  const htmlText = await fetch(googleFinanceUrl).then((x) => x.text());
  const dom = new JSDOM(htmlText);
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
