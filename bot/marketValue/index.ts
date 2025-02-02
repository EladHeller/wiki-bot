import 'dotenv/config';
import { getLocalDate, prettyNumericValue } from '../utilities';
import { MayaMarketValue, getMarketValue } from '../API/mayaAPI';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, templateFromKeyValueData } from '../wiki/newTemplateParser';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import parseTableText, { buildTable } from '../wiki/wikiTableParser';
import { WikiPage } from '../types';
import { getParagraphContent } from '../wiki/paragraphParser';

const baseMarketValueTemplate = 'תבנית:שווי שוק חברה בורסאית';
const baseCompanyNameTemplate = 'תבנית:חברות מאיה';
const baseCompanyLongNameTemplate = 'תבנית:חברות מאיה/שם מלא';

async function updateTemplate(
  api: IWikiApi,
  marketValues: MayaMarketValue[],
  keys: [keyof MayaMarketValue, keyof MayaMarketValue],
  baseTemplateName: string,
  isNumericValue: boolean = true,
  showTimestamp: boolean = true,
) {
  const templateName = `${baseTemplateName}/נתונים`;
  const { content, revid } = await api.articleContent(templateName);
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
  const res = await api.edit(
    templateName,
    'עדכון',
    newContent,
    revid,
  );

  console.log(res);

  if ('error' in res) {
    throw new Error(JSON.stringify(res.error));
  }

  await api.purge([baseTemplateName]);
}

async function updateTable(api: IWikiApi, marketValues: MayaMarketValue[]) {
  const { content, revid } = await api.articleContent(baseCompanyNameTemplate);
  const paragraphText = getParagraphContent(content, 'רשימת החברות');
  if (!paragraphText) {
    throw new Error('Failed to get paragraph');
  }
  const tables = parseTableText(paragraphText);
  const table = tables[0];
  if (!table) {
    throw new Error('Failed to parse table');
  }
  const headers = table.rows[0];
  const newTableText = buildTable(
    headers.fields.map((field) => field.toString()),
    marketValues.sort((a, b) => a.id - b.id)
      .map((marketValue) => [
        marketValue.id.toString(),
        `[[{{חברות מאיה|ID=${marketValue.id}}}]]`,
        `[https://maya.tase.co.il/company/${marketValue.id}?view=details {{חברות מאיה/שם מלא|ID=${marketValue.id}}}]`,
      ]),
  );
  const newContent = content.replace(table.text, newTableText);
  if (newContent === content) {
    console.log('No changes in companies table');
    return;
  }
  const res = await api.edit(baseCompanyNameTemplate, 'עדכון', newContent, revid);
  console.log(res);
}

export async function getMayaLinks(api: IWikiApi, withContent = false): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי');
  const props = encodeURIComponent(`extlinks|pageprops${withContent ? '|revisions' : ''}`);
  const mayaLink = encodeURIComponent('maya.tase.co.il/company/');
  const rvprops = encodeURIComponent('content|size');
  const path = '?action=query&format=json'
  // Pages with תבנית:מידע בורסאי
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}&ellimit=5000`
  // wikidata identifier
  + `&ppprop=wikibase_item&redirects=1${
    // Get content of page
    withContent ? `&rvprop=${rvprops}&rvslots=*` : ''
  // Get maya link
  }&elprotocol=https&elquery=${mayaLink}&ellimit=5000`;
  const result = await api.request(path);
  return result.query.pages;
}

export default async function marketValueBot() {
  const api = NewWikiApi();
  await api.login();
  console.log('Login success');
  const results = await getMayaLinks(api);
  const marketValues:MayaMarketValue[] = [];
  for (const page of Object.values(results)) {
    const res = await getMarketValue(page);
    if (res) {
      console.log(page.title);
      marketValues.push(res);
    }
  }
  await updateTemplate(api, marketValues, ['id', 'marketValue'], baseMarketValueTemplate);
  await updateTemplate(api, marketValues, ['id', 'title'], baseCompanyNameTemplate, false, false);
  await updateTemplate(api, marketValues, ['id', 'companyLongName'], baseCompanyLongNameTemplate, false, false);
  await updateTable(api, marketValues);
}

export const main = shabathProtectorDecorator(marketValueBot);
