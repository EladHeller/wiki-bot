import { findTemplates, getTemplateArrayData } from '../../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../../wiki/WikiApi';
import { asyncGeneratorMapWithSequence } from '../../../utilities';
import { WikiPage } from '../../../types';

const TEMPLATE_NAME = 'יזכור';

const replaceQuotesInTemplate = (template: string, pageTitle: string): string => {
  const arrayData = getTemplateArrayData(template, TEMPLATE_NAME, pageTitle);
  if (!arrayData || arrayData.length === 0) return template;

  const originalUrl = arrayData[0].trim();
  const fixedUrl = originalUrl.replace(/"/g, '@');
  return fixedUrl !== originalUrl ? template.replace(originalUrl, fixedUrl) : template;
};

const processPage = async (api: IWikiApi, page: WikiPage): Promise<boolean> => {
  const content = page.revisions?.[0].slots.main['*'];
  const revid = page.revisions?.[0].revid;
  if (!revid) {
    console.log('No revid for', page.title);
    return false;
  }
  if (!content) {
    console.log('No content for', page.title);
    return false;
  }

  const templates = findTemplates(content, TEMPLATE_NAME, page.title);
  if (templates.length === 0) return false;

  const newContent = templates.reduce(
    (acc, template) => acc.replace(template, replaceQuotesInTemplate(template, page.title)),
    content,
  );

  if (newContent === content) return false;

  try {
    await api.edit(page.title, 'תיקון תבנית יזכור', newContent, revid);
    console.log('Updated:', page.title);
    return true;
  } catch (error) {
    console.error(`Error editing ${page.title}:`, error.message);
    return false;
  }
};

export default async function izkorReplaceBrokenChars() {
  const api = WikiApi();
  await api.login();

  console.log('Starting Izkor character replacement...');

  const generator = api.getArticlesWithTemplate(TEMPLATE_NAME);
  const results = await asyncGeneratorMapWithSequence(1, generator, (page) => async () => (
    processPage(api, page)
  ));

  const updatedCount = results.filter((updated) => updated === true).length;
  console.log(`\n=== Summary ===\nUpdated pages: ${updatedCount}`);
}
