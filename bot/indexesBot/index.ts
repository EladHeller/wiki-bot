import { getIndexStocks, getIndicesList } from '../API/mayaAPI';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import parseTableText from '../wiki/wikiTableParser';

const companyNamesPage = 'תבנית:חברות מאיה/נתונים';
const baseIndexesTemplatePage = 'תבנית:מדד תל אביב בסיס';
const indexesTemplatePage = `${baseIndexesTemplatePage}/נתונים`;
const companyIndexesTemplatesBase = 'תבנית:תבניות מדדים';
const companiesIndexesTemplates = `${companyIndexesTemplatesBase}/נתונים`;

const templateStart = '#switch: {{{1}}}';
type IndexData = {
  indexName: string;
  indexStocks: string[];
};

async function getIndexes(api: IWikiApi) {
  const companyIndexesDict: Record<string, string[]> = {};
  const { content: comapniesContent } = await api.articleContent(companyNamesPage);
  const templateData = findTemplate(comapniesContent, '#switch: {{{ID}}}', companyNamesPage);
  const companyIdNameDict = getTemplateKeyValueData(templateData);
  const data: IndexData[] = [];
  const indexes = await getIndicesList();
  for (const index of indexes) {
    const indexStocks = await getIndexStocks(index.IndexId ?? index.Id);
    const stocks = indexStocks.map((stock) => (companyIdNameDict[stock.CompanyId] ? `[[${companyIdNameDict[stock.CompanyId]}]]` : stock.ShortName));
    const uniqueStocks = [...new Set(stocks)];
    data.push({
      indexName: index.IndexHebName,
      indexStocks: uniqueStocks,
    });
    indexStocks.forEach((stock) => {
      if (!companyIndexesDict[stock.CompanyId]) {
        companyIndexesDict[stock.CompanyId] = [];
      }
      companyIndexesDict[stock.CompanyId].push(index.IndexHebName);
    });
  }

  data.sort((a, b) => a.indexName.localeCompare(b.indexName));
  return {
    data,
    companyIndexesDict,
  };
}

async function getSupportedIndexes(api: IWikiApi) : Promise<Record<string, string>> {
  const { content } = await api.articleContent(companyIndexesTemplatesBase);
  const tables = parseTableText(content);
  const { rows } = tables[0];
  return rows
    .filter((row) => row.fields.length === 2)
    .reduce((acc, row) => {
      acc[row.fields[0].toString()] = row.fields[1].toString().replace(/\{\{תב\|(.*)\}\}/, '$1');
      return acc;
    }, {});
}

async function updateCompanyIndexes(api: IWikiApi, companyIndexesDict: Record<string, string[]>) {
  const suppurtedIndexes = await getSupportedIndexes(api);
  const { content: templateContent, revid } = await api.articleContent(companiesIndexesTemplates);
  const templateData = findTemplate(templateContent, '#switch: {{{1}}}', companiesIndexesTemplates);
  const newData = Object.entries(companyIndexesDict).map(([companyId, indexes]) => {
    const companyIndexesTemplates = indexes
      .map((index) => suppurtedIndexes[index])
      .filter((index) => index).map((index) => `{{${index}}}`);
    return [companyId, companyIndexesTemplates.join(' ')];
  });
  const newTemplateText = templateFromKeyValueData(Object.fromEntries(newData), '#switch: {{{1}}}');
  const newContent = templateContent.replace(templateData, newTemplateText);
  if (newContent === templateContent) {
    console.log('No changes in company indexes');
    return;
  }
  await api.edit(companiesIndexesTemplates, 'עדכון', newContent, revid);
  await api.purge([companiesIndexesTemplates]);
}

export default async function indexesBot() {
  const api = NewWikiApi();
  const { content, revid } = await api.articleContent(indexesTemplatePage);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const {
    data: indexes,
    companyIndexesDict,
  } = await getIndexes(api);
  const newTemplateData = indexes.map((index) => [index.indexName, `${index.indexStocks.join(' • ')}`]);

  const oldTemplate = findTemplate(content, templateStart, indexesTemplatePage);
  const newTemplateText = templateFromKeyValueData(Object.fromEntries(newTemplateData), templateStart);
  const newContent = content.replace(oldTemplate, newTemplateText);
  await updateCompanyIndexes(api, companyIndexesDict);
  if (newContent === content) {
    console.log('No changes');
    return;
  }
  await api.edit(indexesTemplatePage, 'עדכון', newContent, revid);
  await api.purge([baseIndexesTemplatePage]);
}

export const main = shabathProtectorDecorator(indexesBot);
