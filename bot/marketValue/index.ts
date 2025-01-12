import 'dotenv/config';
import { getLocalDate, prettyNumericValue } from '../utilities';
import {
  getArticleContent, getMayaLinks, login, purge, updateArticle,
} from '../wiki/wikiAPI';
import { MayaMarketValue, getMarketValue } from '../API/mayaAPI';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, templateFromKeyValueData } from '../wiki/newTemplateParser';

const baseMarketValueTemplate = 'תבנית:שווי שוק חברה בורסאית';
const baseCompanyNameTemplate = 'תבנית:חברות מאיה';

async function updateTemplate(
  marketValues: MayaMarketValue[],
  keys: [keyof MayaMarketValue, keyof MayaMarketValue],
  baseTemplateName: string,
  isNumericValue: boolean = true,
  showTimestamp: boolean = true,
) {
  const templateName = `${baseTemplateName}/נתונים`;
  const content = await getArticleContent(templateName);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const oldTemplate = findTemplate(content, '#switch: {{{ID}}}', templateName);
  const relevantCompanies = marketValues.filter((data) => {
    const value = data[keys[1]];
    return typeof value !== 'number' || value > 0;
  });
  const companies = relevantCompanies.map(
    (marketValue) => {
      const key = marketValue[keys[0]];
      const value = marketValue[keys[1]];
      return [key, isNumericValue ? prettyNumericValue(value?.toString() ?? '0') : value];
    },
  );

  const newTemplate = templateFromKeyValueData({
    ...Object.fromEntries(companies),
    ...(showTimestamp ? { timestamp: getLocalDate(relevantCompanies[0].correctionDate) } : {}),
    '#default': '',
  }, '#switch: {{{ID}}}');
  const newContent = content.replace(oldTemplate, newTemplate);
  const res = await updateArticle(
    templateName,
    'עדכון',
    newContent,
  );

  console.log(res);

  if ('error' in res) {
    throw new Error(JSON.stringify(res.error));
  }

  await purge([baseTemplateName]);
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
  await updateTemplate(marketValues, ['id', 'marketValue'], baseMarketValueTemplate);
  await updateTemplate(marketValues, ['id', 'title'], baseCompanyNameTemplate, false, false);
}

export const main = shabathProtectorDecorator(marketValueBot);
