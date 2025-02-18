import { getCompanyData, WikiPageWithGoogleFinance } from '../API/googleFinanceApi';
import { currencyName, getLocalDate, promiseSequence } from '../utilities';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, templateFromKeyValueData } from '../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import { getGoogleFinanceLinks } from '../wiki/SharedWikiApiFunctions';

const baseMarketValueTemplate = 'תבנית:שווי שוק חברה בורסאית (ארצות הברית)';
const marketValueTemplate = `${baseMarketValueTemplate}/נתונים`;

async function updateTemplate(api: IWikiApi, marketValues: WikiPageWithGoogleFinance[]) {
  const { content, revid } = await api.articleContent(marketValueTemplate);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const oldTemplate = findTemplate(content, '#switch: {{{ID}}}', marketValueTemplate);
  const relevantCompanies = marketValues.filter(({ gf: { marketCap } }) => marketCap.number !== '0');
  const companies = relevantCompanies.map(
    (marketValue) => [
      marketValue.ticker,
      `${marketValue.gf.marketCap.number} [[${currencyName[marketValue.gf.marketCap.currency] ?? marketValue.gf.marketCap.currency}]]`,
    ],
  ).sort((a, b) => (a[0] > b[0] ? 1 : -1));

  const newTemplate = templateFromKeyValueData({
    ...Object.fromEntries(companies),
    timestamp: getLocalDate(relevantCompanies[0].gf.marketCap.date ?? new Date().toDateString()),
    '#default': '',
  }, '#switch: {{{ID}}}');
  const newContent = content.replace(oldTemplate, newTemplate);
  const res = await api.edit(
    marketValueTemplate,
    'עדכון',
    newContent,
    revid,
  );

  console.log(res);

  if ('error' in res) {
    throw new Error(JSON.stringify(res.error));
  }
  await api.purge([baseMarketValueTemplate]);
}

export default async function usMarketValueBot() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');

  const results = await getGoogleFinanceLinks(api);
  console.log('links', Object.keys(results).length);
  const marketValues: WikiPageWithGoogleFinance[] = [];
  const pages = Object.values(results);

  await promiseSequence(25, pages.map((page) => async () => {
    const data = await getCompanyData(page);
    if (data) {
      marketValues.push(data);
    }
  }));

  await updateTemplate(api, marketValues);
}

export const main = shabathProtectorDecorator(usMarketValueBot);
