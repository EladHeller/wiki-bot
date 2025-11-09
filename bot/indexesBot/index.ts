import { getIndexStocks, getIndicesList } from '../API/mayaAPI';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import parseTableText from '../wiki/wikiTableParser';

const companyWikiPageTemplate = 'תבנית:חברות מאיה/נתונים';
const companyNameTemplate = 'תבנית:חברות מאיה/שם מלא/נתונים';
const baseIndexesTemplatePage = 'תבנית:מדד תל אביב בסיס';
const indexesTemplatePage = `${baseIndexesTemplatePage}/נתונים`;
const companyIndexesTemplatesBase = 'תבנית:מדדי הבורסה לניירות ערך בתל אביב';
const companiesIndexesTemplates = `${companyIndexesTemplatesBase}/נתונים`;

const templateStart = '#switch: {{{1}}}';
type IndexData = {
  indexName: string;
  indexStocks: string[];
};

async function getCompanysData(api: IWikiApi, templateName: string) {
  const { content } = await api.articleContent(templateName);
  const templateData = findTemplate(content, '#switch: {{{ID}}}', templateName);
  return getTemplateKeyValueData(templateData);
}

function getCompanyShowName(
  companyId: number,
  companyIdArticleDict: Record<string, string>,
  companyIdNameDict: Record<string, string>,
): string | null {
  if (companyIdArticleDict[companyId]) {
    return `[[${companyIdArticleDict[companyId]}]]`;
  }
  if (companyIdNameDict[companyId]) {
    return companyIdNameDict[companyId];
  }
  return null;
}

async function getIndexes(api: IWikiApi) {
  const companyIndexesDict: Record<string, string[]> = {};
  const companyIdArticleDict = await getCompanysData(api, companyWikiPageTemplate);
  const companyIdNameDict = await getCompanysData(api, companyNameTemplate);
  const data: IndexData[] = [];
  const indexes = await getIndicesList();
  for (const index of indexes) {
    const indexStocks = await getIndexStocks(index.IndexId ?? index.Id);
    const stocks = indexStocks.map(
      (stock) => getCompanyShowName(stock.CompanyId, companyIdArticleDict, companyIdNameDict)
      ?? stock.ShortName,
    );
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

async function getSupportedIndexes(api: IWikiApi) : Promise<Record<string, {template: string, category: string}>> {
  const { content } = await api.articleContent(companyIndexesTemplatesBase);
  const tables = parseTableText(content);
  const { rows } = tables[0];
  return rows
    .filter((row) => row.fields.length === 2)
    .reduce((acc, row) => {
      const templateName = row.fields[1].toString().match(/\{\{תב\|(.*)\}\}/)?.[1];
      const category = row.fields[1].toString().match(/\[\[:קטגוריה:(.*)\]\]/)?.[1];
      acc[row.fields[0].toString()] = {
        template: templateName,
        category: category ?? '',
      };
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
      .filter((index) => index && index.template)
      .map(({ category, template }) => `{{${template}}} ${category ? `[[קטגוריה:${category}]]` : ''}`);
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
  const api = WikiApi();
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
