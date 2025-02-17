import { findTemplate, getTemplateKeyValueData } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

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
  const api = WikiApi();
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

const identityControl = '{{בקרת זהויות}}';
async function fixPage(api: IWikiApi, title: string, revid?: number, content?: string) {
  if (!content || !revid) {
    console.log('No content or revid for', title);
    return;
  }
  const identityControlIndex = content.indexOf(identityControl);
  if (identityControlIndex === -1) {
    console.log('No identity control for', title);
    return;
  }

  const templateIndex = content.indexOf(`{{${baseTemplateName}`);

  if (templateIndex === -1) {
    console.log('No template for', title);
    return;
  }
  if (templateIndex < identityControlIndex) {
    console.log('Identity control is after template for', title);
    return;
  }

  const templateText = findTemplate(content, baseTemplateName, title);
  let newContent = content;
  newContent = newContent.replace(`${templateText}\n\n`, '');
  if (newContent === content) {
    console.log('No changes in', title);
    return;
  }
  newContent = newContent.replace(identityControl, `${templateText}\n${identityControl}`);

  try {
    const res = await api.edit(title, 'תיקון סדר התבניות בדף', newContent, revid);
    console.log('Fixed', title, res);
  } catch (e) {
    console.error('Failed to fix', title, e);
  }
}

export async function fixTemplateOrder() {
  const api = WikiApi();
  const generator = api.getArticlesWithTemplate(baseTemplateName);
  for await (const batch of generator) {
    for (const { title, revisions } of batch) {
      const revid = revisions?.[0].revid;
      const content = revisions?.[0].slots.main['*'];
      await fixPage(api, title, revid, content);
    }
  }
}
