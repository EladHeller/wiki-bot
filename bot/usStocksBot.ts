import 'dotenv/config';
import getStockData, { GoogleFinanceData } from './googleFinanceApi';
import { getLocalDate, prettyNumericValue } from './utilities';
import {
  getArticleContent,
  getGoogleFinanceLinks,
  getToken, login, updateArticle, WikiPage,
} from './wikiAPI';
import WikiTemplateParser from './WikiTemplateParser';

const googleFinanceRegex = /^https:\/\/www\.google\.com\/finance\?q=(\w+)$/;

const marketValueTemplate = '(ארצות הברית) תבנית:שווי שוק חברה בורסאית';

interface WikiPageWithGoogleFinance {
    gf: GoogleFinanceData;
    wiki: WikiPage;
}

async function updateTemplate(marketValues: WikiPageWithGoogleFinance[]) {
  const content = await getArticleContent(marketValueTemplate);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const template = new WikiTemplateParser(content, '#switch: {{{ID}}}');
  const oldTemplate = template.templateText;
  const relevantCompanies = marketValues.filter(({ gf: { marketCap } }) => marketCap);
  const companies = relevantCompanies.map(
    (marketValue) => [
      marketValue.wiki.pageid,
      prettyNumericValue(marketValue.gf.marketCap?.toString() || '0'),
    ],
  );

  template.updateTamplateFromData({
    ...Object.fromEntries(companies),
    timestamp: getLocalDate(new Date().toDateString()),
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

export async function main() {
  const logintoken = await getToken();
  await login(logintoken);
  console.log('Login success');

  const results = await getGoogleFinanceLinks();
  console.log('links', Object.keys(results).length);
  const marketValues: WikiPageWithGoogleFinance[] = [];
  for (const page of Object.values(results)) {
    const extLink = page.extlinks?.find((link) => link['*'].match(googleFinanceRegex))?.['*'];
    console.log('extLink', page.title, extLink);
    if (extLink) {
      const res = await getStockData(extLink);
      if (res) {
        console.log('after', page.title);
        marketValues.push({
          gf: res,
          wiki: page,
        });
      }
    }
  }
  await updateTemplate(marketValues);
}

export default {
  main,
};
