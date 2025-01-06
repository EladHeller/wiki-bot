import { getIndexStocks, getIndicesList } from '../API/mayaAPI';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';

const companyNamesPage = 'תבנית:חברות מאיה/נתונים';
const baseindexesTemplatePage = 'תבנית:מדד תל אביב בסיס';
const indexesTemplatePage = `${baseindexesTemplatePage}/נתונים`;
const templateStart = '#switch: {{{1}}}';
type IndexData = {
  indexName: string;
  indexStocks: string[];
};

async function getIndexes(api: IWikiApi) {
  const { content: comapniesContent } = await api.articleContent(companyNamesPage);
  const templateData = findTemplate(comapniesContent, '#switch: {{{ID}}}', companyNamesPage);
  const companyIdNameDict = getTemplateKeyValueData(templateData);
  const data: IndexData[] = [];
  const indexes = await getIndicesList();
  for (const index of indexes) {
    const indexStocks = await getIndexStocks(index.IndexId ?? index.Id);
    const stocks = indexStocks.map((stock) => (companyIdNameDict[stock.CompanyId] ? `[[${companyIdNameDict[stock.CompanyId]}]]` : stock.ShortName));
    const uniqueStocks = [...new Set(stocks)];
    uniqueStocks.sort((a, b) => a.localeCompare(b));
    data.push({
      indexName: index.IndexHebName,
      indexStocks: uniqueStocks,
    });
  }

  data.sort((a, b) => a.indexName.localeCompare(b.indexName));
  return data;
}

export default async function indexesBot() {
  const api = NewWikiApi();
  const { content, revid } = await api.articleContent(indexesTemplatePage);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const indexes = await getIndexes(api);
  const newTemplateData = indexes.map((index) => [index.indexName, `${index.indexStocks.join(' • ')}`]);

  const oldTemplate = findTemplate(content, templateStart, indexesTemplatePage);
  const newTemplateText = templateFromKeyValueData(Object.fromEntries(newTemplateData), templateStart);
  const newContent = content.replace(oldTemplate, newTemplateText);
  if (newContent === content) {
    console.log('No changes');
    return;
  }
  await api.edit(indexesTemplatePage, 'עדכון', newContent, revid);
}

export const main = shabathProtectorDecorator(indexesBot);
