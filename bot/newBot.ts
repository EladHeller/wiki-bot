import 'dotenv/config';
import { getMarketValue, MayaMarketValue } from './mayaAPI';
import { prettyNumericValue } from './utilities';
import {
  getArticleContent,
  getMayaLinks, getToken, login, updateArticle,
} from './wikiAPI';
import WikiTemplateParser from './WikiTemplateParser';

function getHebrewDate(dateString:string): string {
  const date = new Date(dateString);
  return `${date.toLocaleString('he', { month: 'long', day: 'numeric' })} ${new Date(date).getFullYear()}`;
}
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
    timestamp: getHebrewDate(relevantCompanies[0].correctionDate),
    '#default': '',
  });
  const newContent = content.replace(oldTemplate, template.templateText);
  const res = await updateArticle(
    marketValueTemplate,
    'עדכון',
    newContent,
  );
  console.log(res);
}

export async function main() {
  const logintoken = await getToken();
  await login(logintoken);
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
