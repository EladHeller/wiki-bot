import 'dotenv/config';
import fs from 'fs/promises';
import { getMarketValue, MayaMarketValue } from './mayaAPI';
import { prettyNumericValue } from './utilities';
import {
  getArticleContent,
  getMayaLinks, getToken, login, updateArticle,
} from './wikiAPI';
import WikiTemplateParser from './WikiTemplateParser';

function getHebrewDate(dateString:string): string {
  const date = new Date(dateString);
  return `[[${date.toLocaleString('he', { month: 'long', day: 'numeric' })}]] [[${new Date(date).getFullYear()}]]`;
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
  // await fs.writeFile(marketValueTemplate, newContent, 'utf-8');
  const res = await updateArticle(
    marketValueTemplate, 'עדכון', newContent,
  );
  console.log(res);
}

async function main() {
  const logintoken = await getToken();
  await login(logintoken);
  console.log('Login success');

  const results = await getMayaLinks();
  const marketValues:MayaMarketValue[] = [];
  await fs.writeFile('./bot-res.json', JSON.stringify(results, null, 2), 'utf8');
  for (const page of Object.values(results)) {
    const res = await getMarketValue(page);
    if (res) {
      console.log(page.title);
      marketValues.push(res);
    }
  }
  await fs.writeFile('./maya-markets-res.json', JSON.stringify(marketValues, null, 2), 'utf8');
  // const marketValues = JSON.parse(await fs.readFile('./maya-markets-res.json', 'utf8'));
  await updateTemplate(marketValues);
}

main().catch((error) => {
  if (error?.data) {
    console.log(error?.data);
  } else if (error?.message) {
    console.log(error?.message);
  } else {
    console.log(error);
  }
});
