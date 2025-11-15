import {
  findTemplates, getTemplateArrayData, getTemplateData, templateFromTemplateData,
} from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';
import { WikiPage } from '../../types';

const OLD_TEMPLATE_NAME = 'רמבם';
const NEW_TEMPLATE_NAME = 'רמב"ם';
const TEMPLATE_TO_REMOVE = 'ללא בוט ייבוא';
const IMAGE_FOR_PROCESSING_TEMPLATE = 'תמונה לטיפול';

function replaceRambamTemplates(content: string, title: string) {
  const templates = findTemplates(content, OLD_TEMPLATE_NAME, title);
  return templates.reduce((updatedContent, template) => {
    const templateData = getTemplateData(template, OLD_TEMPLATE_NAME, title);
    if (templateData.arrayData?.[0]) {
      templateData.arrayData.splice(0, 1);
    }
    const newTemplate = templateFromTemplateData(templateData, NEW_TEMPLATE_NAME);
    return updatedContent.replace(template, newTemplate);
  }, content);
}

function removeTemplate(content: string, templateName: string, title: string) {
  const templates = findTemplates(content, templateName, title);
  return templates.reduce((updatedContent, template) => {
    const withoutDoubleNewline = updatedContent.replace(`${template}\n\n`, '');
    const withoutSingleNewline = withoutDoubleNewline.replace(`${template}\n`, '');
    return withoutSingleNewline.replace(template, '');
  }, content);
}

function removeImageForProcessingTemplate(content: string, templateName: string, title: string) {
  const templates = findTemplates(content, templateName, title);
  return templates.reduce((updatedContent, template) => {
    const templateArrayData = getTemplateArrayData(template, templateName, title);
    if (templateArrayData[0]) {
      return updatedContent.replace(template, templateArrayData[0]);
    }

    return updatedContent.replace(`${template}|`, '');
  }, content);
}

function processPageContent(content: string, title: string) {
  const afterRambamReplace = replaceRambamTemplates(content, title);
  const afterTemplateRemoval = removeTemplate(afterRambamReplace, TEMPLATE_TO_REMOVE, title);
  const afterPipeTemplateRemoval = removeImageForProcessingTemplate(
    afterTemplateRemoval,
    IMAGE_FOR_PROCESSING_TEMPLATE,
    title,
  );
  return afterPipeTemplateRemoval;
}

function buildEditSummary(content: string, title: string) {
  const hadRambam = findTemplates(content, OLD_TEMPLATE_NAME, title).length > 0;
  const hadTemplateToRemove = findTemplates(content, TEMPLATE_TO_REMOVE, title).length > 0;
  const hadImageForProcessingTemplate = findTemplates(content, IMAGE_FOR_PROCESSING_TEMPLATE, title).length > 0;

  const parts = [
    hadRambam ? `החלפת תבנית ${OLD_TEMPLATE_NAME} ל-${NEW_TEMPLATE_NAME}` : '',
    hadTemplateToRemove ? `הסרת תבנית ${TEMPLATE_TO_REMOVE}` : '',
    hadImageForProcessingTemplate ? `הסרת תבנית ${IMAGE_FOR_PROCESSING_TEMPLATE}` : '',
  ].filter(Boolean);

  return parts.join('; ');
}

function processPage(api: ReturnType<typeof WikiApi>, processedPages: Set<number>) {
  return (page: WikiPage) => async () => {
    const content = page.revisions?.[0]?.slots.main['*'];
    const revid = page.revisions?.[0]?.revid;
    const pageId = page.pageid;

    if (!revid || !content || !pageId) {
      console.log(`Missing revid, content, or pageid for ${page.title}`);
      return null;
    }

    if (processedPages.has(pageId)) {
      console.log(`Skipping ${page.title} - already processed`);
      return null;
    }

    processedPages.add(pageId);

    const newContent = processPageContent(content, page.title);

    if (newContent === content) {
      console.log(`No changes needed for ${page.title}`);
      return null;
    }

    const summary = buildEditSummary(content, page.title);

    try {
      await api.edit(page.title, summary, newContent, revid);
      console.log(`✓ Updated ${page.title}: ${summary}`);
      return page.title;
    } catch (error) {
      console.error(`✗ Failed to update ${page.title}:`, error.message);
      return null;
    }
  };
}

async function collectPagesFromGenerator(generator: AsyncGenerator<WikiPage[], void, void>) {
  const pages: WikiPage[] = [];
  for await (const batch of generator) {
    pages.push(...batch);
  }
  return pages;
}

async function processPagesSequentially(
  api: ReturnType<typeof WikiApi>,
  pages: WikiPage[],
  processedPages: Set<number>,
) {
  const results: (string | null)[] = [];
  for (const page of pages) {
    if (page.title.startsWith('ויקיפדיה:מיזמי ויקיפדיה/אתר האנציקלופדיה היהודית/')) {
      const result = await processPage(api, processedPages)(page)();
      results.push(result);
    }
  }
  return results;
}

export default async function replaceRambamTemplate() {
  const api = WikiApi();
  await api.login();

  console.log('Starting template replacement and removal...');
  console.log(`1. Replacing ${OLD_TEMPLATE_NAME} with ${NEW_TEMPLATE_NAME}`);
  console.log(`2. Removing ${TEMPLATE_TO_REMOVE}`);
  console.log(`3. Removing ${IMAGE_FOR_PROCESSING_TEMPLATE}`);

  const processedPages = new Set<number>();

  const rambamGenerator = api.getArticlesWithTemplate(OLD_TEMPLATE_NAME, undefined, 'תבנית', '*');
  const removeGenerator = api.getArticlesWithTemplate(TEMPLATE_TO_REMOVE, undefined, 'תבנית', '*');
  const imageForProcessingGenerator = api.getArticlesWithTemplate(
    IMAGE_FOR_PROCESSING_TEMPLATE,
    undefined,
    'תבנית',
    '*',
  );

  const [rambamPages, removePages, imageForProcessingPages] = await Promise.all([
    collectPagesFromGenerator(rambamGenerator),
    collectPagesFromGenerator(removeGenerator),
    collectPagesFromGenerator(imageForProcessingGenerator),
  ]);

  const allPages = [...rambamPages, ...removePages, ...imageForProcessingPages];

  console.log(`\nFound ${rambamPages.length} pages with ${OLD_TEMPLATE_NAME}`);
  console.log(`Found ${removePages.length} pages with ${TEMPLATE_TO_REMOVE}`);
  console.log(`Found ${imageForProcessingPages.length} pages with ${IMAGE_FOR_PROCESSING_TEMPLATE}`);
  console.log(`Total pages to check: ${allPages.length}\n`);

  const results = await processPagesSequentially(api, allPages, processedPages);

  const updatedPages = results.filter(Boolean);

  console.log(`\nCompleted! Updated ${updatedPages.length} out of ${processedPages.size} unique pages.`);
}
