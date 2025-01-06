import 'dotenv/config';
import { getLocalDate, prettyNumericValue } from '../utilities';
import {
  getArticleContent, getMayaLinks, login, purge, updateArticle,
} from '../wiki/wikiAPI';
import { MayaMarketValue, getMarketValue } from '../API/mayaAPI';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, templateFromKeyValueData } from '../wiki/newTemplateParser';

const baseMarketValueTemplate = 'תבנית:שווי שוק חברה בורסאית';
const marketValueTemplate = `${baseMarketValueTemplate}/נתונים`;
const baseCompanyNameTemplate = 'תבנית:חברות מאיה';
const companyNameTemplate = `${baseCompanyNameTemplate}/נתונים`;

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

async function updateNameTemplate(marketValues: MayaMarketValue[]) {
  const content = await getArticleContent(companyNameTemplate);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const data = marketValues.map((marketValue) => [marketValue.id, marketValue.title])
    .sort((a, b) => ((a[0] || 0) > (b[0] || 0) ? 1 : -1));
  const oldTemplate = findTemplate(content, '#switch: {{{ID}}}', companyNameTemplate);
  const newTemplate = templateFromKeyValueData({
    ...Object.fromEntries(data),
    timestamp: getLocalDate(marketValues[0].correctionDate),
    '#default': '',
  }, '#switch: {{{ID}}}');
  const newContent = content.replace(oldTemplate, newTemplate);
  const res = await updateArticle(
    companyNameTemplate,
    'עדכון',
    newContent,
  );

  console.log(res);
  if ('error' in res) {
    throw new Error(JSON.stringify(res.error));
  }
  await purge([baseCompanyNameTemplate]);
}

export default async function marketValueBot() {
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
  await updateNameTemplate(marketValues);
}

export const main = shabathProtectorDecorator(marketValueBot);
