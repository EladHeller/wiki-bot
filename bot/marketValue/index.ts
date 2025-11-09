import { getLocalDate, prettyNumericValue } from '../utilities';
import { MayaMarketValue, getMarketValueById } from '../API/mayaAPI';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, templateFromKeyValueData } from '../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import parseTableText, { buildTable } from '../wiki/wikiTableParser';
import { getParagraphContent } from '../wiki/paragraphParser';
import { companiesWithMayaId } from '../wiki/WikidataSparql';

const baseMarketValueTemplate = 'תבנית:שווי שוק חברה בורסאית';
const baseCompanyNameTemplate = 'תבנית:חברות מאיה';
const baseCompanyLongNameTemplate = 'תבנית:חברות מאיה/שם מלא';
const baseWikiDataTemplate = 'תבנית:חברות מאיה/ויקינתונים';

export async function updateTemplate(
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
    return value != null && value !== '' && (typeof value !== 'number' || value > 0);
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
        `{{#if:{{{חברות מאיה|ID=${marketValue.id}}}|[[{{חברות מאיה|ID=${marketValue.id}}}]]|-}}`,
        `[https://maya.tase.co.il/company/${marketValue.id}?view=details {{חברות מאיה/שם מלא|ID=${marketValue.id}}}]`,
        `[[:d:${marketValue.wikiDataId}|{{חברות מאיה/ויקינתונים|ID=${marketValue.id}}}]]`,
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

async function getWikiDataCompanies() {
  const results = await companiesWithMayaId();
  const data: MayaMarketValue[] = [];
  for (const result of results) {
    const res = await getMarketValueById(result.mayaId);
    if (!res) {
      throw new Error(`Failed to get market value for ${result.mayaId}`);
    }
    data.push({
      wikiDataId: result.entityId,
      id: res.id,
      companyLongName: res.companyLongName,
      title: result.articleName,
      marketValue: res.marketValue,
      correctionDate: res.correctionDate,
    });
  }

  return data;
}

export default async function marketValueBot() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');
  const marketValues = await getWikiDataCompanies();
  await updateTemplate(api, marketValues, ['id', 'marketValue'], baseMarketValueTemplate);
  await updateTemplate(api, marketValues, ['id', 'title'], baseCompanyNameTemplate, false, false);
  await updateTemplate(api, marketValues, ['id', 'companyLongName'], baseCompanyLongNameTemplate, false, false);
  await updateTemplate(api, marketValues, ['id', 'wikiDataId'], baseWikiDataTemplate, false, false);
  await updateTable(api, marketValues);
}

export const main = shabathProtectorDecorator(marketValueBot);
