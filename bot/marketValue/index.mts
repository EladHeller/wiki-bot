import 'dotenv/config';
import { getLocalDate, prettyNumericValue } from '../utilities';
import {
  getArticleContent, getMayaLinks, login, purge, updateArticle,
} from '../wiki/wikiAPI';
import { MayaMarketValue, getMarketValue } from '../API/mayaAPI.js';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, templateFromKeyValueData } from '../wiki/newTemplateParser';

const baseMarketValueTemplate = 'תבנית:שווי שוק חברה בורסאית';
const marketValueTemplate = `${baseMarketValueTemplate}/נתונים`;

async function updateTemplate(marketValues: MayaMarketValue[]) {
  const content = await getArticleContent(marketValueTemplate);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const oldTemplate = findTemplate(content, '#switch: {{{ID}}}', marketValueTemplate);
  const relevantCompanies = marketValues.filter(({ marketValue }) => marketValue > 0);
  const companies = relevantCompanies.map(
    (marketValue) => [marketValue.id, prettyNumericValue(marketValue.marketValue.toString())],
  );
  const newTemplate = templateFromKeyValueData({
    ...Object.fromEntries(companies),
    timestamp: getLocalDate(relevantCompanies[0].correctionDate),
    '#default': '',
  }, '#switch: {{{ID}}}');
  const newContent = content.replace(oldTemplate, newTemplate);
  const res = await updateArticle(
    marketValueTemplate,
    'עדכון',
    newContent,
  );

  console.log(res);

  if ('error' in res) {
    throw new Error(JSON.stringify(res.error));
  }

  await purge([baseMarketValueTemplate]);
}

async function marketValueBot() {
  await login();
  console.log('Login success');

  const results = await getMayaLinks();
  const marketValues:MayaMarketValue[] = [];
  for (const page of Object.values(results)) {
    const res = await getMarketValue(page);
    if (res) {
      console.log(page.title);
      marketValues.push(res);
    }
  }
  await updateTemplate(marketValues);
}

export const main = shabathProtectorDecorator(marketValueBot);

export default {
  main,
};
