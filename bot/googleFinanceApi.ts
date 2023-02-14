import { JSDOM } from 'jsdom';

function getValueFromTextNodes(textNodes: Text[], label: string): string | undefined {
  const node = textNodes.find((textNode) => textNode.textContent?.trim().toUpperCase() === label);
  return node?.parentElement?.parentElement?.parentElement?.lastChild?.textContent ?? undefined;
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
}

export interface GoogleFinanceData {
    marketCap: MarketCap;
}

function marketCapTextToNumber(marketCap: string): MarketCap {
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
  const marketCap = getValueFromTextNodes(textNodes, 'MARKET CAP');

  return {
    marketCap: marketCapTextToNumber(marketCap ?? ''),
  };
}
