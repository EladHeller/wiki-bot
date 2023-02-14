import { JSDOM } from 'jsdom';

function getValueFromTextNodes(textNodes: Text[], label: string): string | undefined {
  const node = textNodes.find((textNode) => textNode.textContent?.trim().toUpperCase() === label);
  return node?.parentElement?.parentElement?.parentElement?.lastChild?.textContent ?? undefined;
}

const powerSignToNumber = {
  K: 1e3,
  M: 1e6,
  B: 1e9,
  T: 1e12,
};

function marketCapTextToNumber(marketCap: string) {
  const matches = marketCap.match(/(\d{1,3}(?:\.\d{1,2}))(\w)/);
  if (!matches) {
    return 0;
  }
  const num = Number(matches[1]);
  if (!num) {
    return 0;
  }
  return num * powerSignToNumber[matches[2]];
}

export interface GoogleFinanceData {
    marketCap?: number;
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
    marketCap: marketCap != null ? marketCapTextToNumber(marketCap) : marketCap,
  };
}
