/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import { getCompanyData, WikiPageWithGoogleFinance } from './googleFinanceApi';
import { currencyName, getLocalDate, promiseSequence } from './utilities';
import {
  getArticleContent,
  getGoogleFinanceLinks,
  getToken, login, updateArticle,
} from './wikiAPI';
import WikiTemplateParser from './WikiTemplateParser';

const marketValueTemplate = 'תבנית:שווי שוק חברה בורסאית (ארצות הברית)';

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
  ).sort((a, b) => (a[0] > b[0] ? 1 : -1));

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

export async function main() {
  const logintoken = await getToken();
  await login(logintoken);
  console.log('Login success');

  const results = await getGoogleFinanceLinks();
  console.log('links', Object.keys(results).length);
  const marketValues: WikiPageWithGoogleFinance[] = [];
  const pages = Object.values(results);

  await promiseSequence(10, pages.map((page) => async () => {
    const data = await getCompanyData(page);
    if (data) {
      marketValues.push(data);
    }
  }));

  await updateTemplate(marketValues);
}
