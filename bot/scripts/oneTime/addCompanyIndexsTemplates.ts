import { findTemplate, getTemplateKeyValueData } from '../../wiki/newTemplateParser';
import NewWikiApi, { IWikiApi } from '../../wiki/NewWikiApi';

const existingTemplates = [
  'מדד תל אביב 35',
  'מדד תל אביב 90',
  'מדד תל אביב 125',
  'מדד תל אביב SME60',
  'מדד תל אביב SME150',
  'מדד תל אביב ביומד',
  'מדד תל אביב בסיס',
  'מדד תל אביב גלובל-בלוטק',
  'מדד תל אביב טכנולוגיה',
  'מדד תל אביב טק-עילית',
  'מדד תל אביב נדל"ן',
  'מדד תל אביב נפט וגז',
  'מדד תל אביב פיננסים',
  'מדד תל אביב רשתות שיווק',
  'מדד תל אביב תשתיות אנרגיה',
];

const existingCategories = [
  'קטגוריה:חברות הנכללות במדד תל אביב 35',
  'קטגוריה:חברות הנכללות במדד תל אביב 90',
  'קטגוריה:חברות הנכללות במדד תל אביב ביומד',
  'קטגוריה:חברות הנכללות במדד תל אביב טכנולוגיה',
];

const baseTemplateName = 'מדדי הבורסה לניירות ערך בתל אביב';
const dataTemplateName = `תבנית:${baseTemplateName}/נתונים`;
const idToPageTemplateName = 'תבנית:חברות מאיה/נתונים';

async function getCompanyTemplates(api: IWikiApi) {
  const { content } = await api.articleContent(dataTemplateName);
  const templateText = findTemplate(content, '#switch: {{{1}}}', dataTemplateName);
  const templateData = getTemplateKeyValueData(templateText);
  return Object.fromEntries(
    Object.entries(templateData).filter(([, value]) => value.trim() !== ''),
  );
}

async function getCompanyIdNameMapping(api: IWikiApi) {
  const { content } = await api.articleContent(idToPageTemplateName);
  const templateText = findTemplate(content, '#switch: {{{ID}}}', idToPageTemplateName);
  return getTemplateKeyValueData(templateText);
}

async function removeOldDataAndInsertTemplate(api: IWikiApi, companyId: string, companyName: string) {
  const { content, revid } = await api.articleContent(companyName);
  let newContent = content;
  const isTemplateAlreadyExist = newContent.includes(`{{${baseTemplateName}`);
  for (const template of existingTemplates) {
    newContent = newContent.replace(`{{${template}}}\n`, '');
    newContent = newContent.replace(`{{${template}}}`, '');
  }
  for (const category of existingCategories) {
    newContent = newContent.replace(`[[${category}]]\n`, '');
    newContent = newContent.replace(`[[${category}]]`, '');
  }
  if (newContent.includes('{{תבניות מדדים|')) {
    newContent = newContent.replace(`{{תבניות מדדים|${companyId}}}`, '');
  }
  if (!isTemplateAlreadyExist) {
    newContent = newContent.replace('[[קטגוריה:', `{{${baseTemplateName}|${companyId}}}\n\n[[קטגוריה:`);
  }
  if (newContent === content) {
    console.log('No changes in', companyName);
    return;
  }
  await api.edit(companyName, 'מעבר לשימוש בתבנית ״מדדי הבורסה לניירות ערך בתל אביב״', newContent, revid);
}

export default async function addCompanyIndexsTemplates() {
  const api = NewWikiApi();
  const companyTemplates = await getCompanyTemplates(api);
  const companyIdToName = await getCompanyIdNameMapping(api);
  const companiesWithArticle: string[][] = Object.keys(companyTemplates).map((companyId) => {
    const name = companyIdToName[companyId];
    if (name) {
      return [companyId, name];
    }
    return [];
  })
    .filter((data) => data.length);
  for (const [companyId, name] of companiesWithArticle) {
    await removeOldDataAndInsertTemplate(api, companyId, name);
  }
}
