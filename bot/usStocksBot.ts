import 'dotenv/config';
import getStockData, { GoogleFinanceData } from './googleFinanceApi';
import { currencyName, getLocalDate } from './utilities';
import {
  getArticleContent,
  getGoogleFinanceLinks,
  getToken, login, updateArticle, WikiPage,
} from './wikiAPI';
import WikiTemplateParser from './WikiTemplateParser';

const googleFinanceRegex = /^https:\/\/www\.google\.com\/finance\?q=(\w+)$/;

const marketValueTemplate = 'תבנית:שווי שוק חברה בורסאית (ארצות הברית)';

interface WikiPageWithGoogleFinance {
    gf: GoogleFinanceData;
    wiki: WikiPage;
    ticker: string;
}

export async function getCompanyData(
  page: WikiPage,
): Promise<WikiPageWithGoogleFinance | undefined> {
  const extLink = page.extlinks?.find((link) => link['*'].match(googleFinanceRegex))?.['*'];
  if (!extLink) {
    console.log('no extLink', page.title, extLink);
  } else {
    try {
      const res = await getStockData(extLink);
      if (res) {
        console.log('after', page.title);
        return {
          gf: res,
          ticker: extLink.split('?q=')[1] ?? '',
          wiki: page,
        };
      }
      console.log('no results', page.title);
    } catch (e) {
      console.error(page.pageid, e);
    }
  }
  return undefined;
}

async function updateTemplate(marketValues: WikiPageWithGoogleFinance[]) {
  const content = await getArticleContent(marketValueTemplate);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const template = new WikiTemplateParser(content, '#switch: {{{ID}}}');
  const oldTemplate = template.templateText;
  const relevantCompanies = marketValues.filter(({ gf: { marketCap } }) => marketCap.number !== '0');
  const companies = relevantCompanies.map(
    (marketValue) => [
      marketValue.ticker,
      `${marketValue.gf.marketCap.number} [[${currencyName[marketValue.gf.marketCap.currency] ?? marketValue.gf.marketCap.currency}]]`,
    ],
  );

  template.updateTamplateFromData({
    ...Object.fromEntries(companies),
    timestamp: getLocalDate(relevantCompanies[0].gf.marketCap.date ?? new Date().toDateString()),
    '#default': '',
  });
  const newContent = content.replace(oldTemplate, template.templateText);
  const res = await updateArticle(
    marketValueTemplate,
    'עדכון',
    newContent,
  );

  console.log(res);

  if ('error' in res) {
    throw new Error(JSON.stringify(res.error));
  }
}

async function main() {
  const logintoken = await getToken();
  await login(logintoken);
  console.log('Login success');

  const results = await getGoogleFinanceLinks();
  console.log('links', Object.keys(results).length);
  const marketValues: WikiPageWithGoogleFinance[] = [];
  const pages = Object.values(results);
  let pagesBatch = pages.splice(0, 10);
  while (pagesBatch.length > 0) {
    await Promise.all(pagesBatch.map(async (page) => {
      const data = await getCompanyData(page);
      if (data) {
        marketValues.push(data);
      }
    }));
    pagesBatch = pages.splice(0, 10);
  }
  await updateTemplate(marketValues);
}

export default {
  main,
};
