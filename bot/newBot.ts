import 'dotenv/config';
import { getMarketValue, MayaMarketValue } from './mayaAPI';
import { getLocalDate, prettyNumericValue } from './utilities';
import {
  getArticleContent, getMayaLinks, login, updateArticle,
} from './wiki/wikiAPI';
import WikiTemplateParser from './wiki/WikiTemplateParser';

const marketValueTemplate = 'תבנית:שווי שוק חברה בורסאית';

async function updateTemplate(marketValues: MayaMarketValue[]) {
  const content = await getArticleContent(marketValueTemplate);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const template = new WikiTemplateParser(content, '#switch: {{{ID}}}');
  const oldTemplate = template.templateText;
  const relevantCompanies = marketValues.filter(({ marketValue }) => marketValue > 0);
  const companies = relevantCompanies.map(
    (marketValue) => [marketValue.id, prettyNumericValue(marketValue.marketValue.toString())],
  );

  template.updateTamplateFromData({
    ...Object.fromEntries(companies),
    timestamp: getLocalDate(relevantCompanies[0].correctionDate),
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

export default {
  main,
};
