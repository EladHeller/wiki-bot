import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const TEMPLATE_CONFIGS = {
  'כלי תקשורת': {
    renames: {
      'התחלת פעילות': 'תאריך התחלה',
      'סיום פעילות': 'תאריך סיום',
    },
    deletes: [],
  },
};

function processTemplate(
  template: string,
  config: typeof TEMPLATE_CONFIGS[keyof typeof TEMPLATE_CONFIGS],
): string | null {
  const originalKeyValueData = getTemplateKeyValueData(template);
  const keyValueData = { ...originalKeyValueData };

  let hasAnyChanges = false;
  for (const [oldKey, newKey] of Object.entries(config.renames)) {
    if (keyValueData[oldKey] !== undefined) {
      keyValueData[newKey] = keyValueData[oldKey];
      delete keyValueData[oldKey];
      hasAnyChanges = true;
    }
  }

  if (hasAnyChanges) {
    return templateFromKeyValueData(keyValueData, 'כלי תקשורת');
  }
  return null;
}

async function processArticle(
  api: IWikiApi,
  page: WikiPage,
  templateName: string,
  config: typeof TEMPLATE_CONFIGS[keyof typeof TEMPLATE_CONFIGS],
): Promise<void> {
  const content = page.revisions?.[0]?.slots.main['*'];
  const revid = page.revisions?.[0]?.revid;

  if (!revid || !content) {
    console.log(`Missing revid or content for ${page.title}`);
    return;
  }

  let newContent = content;
  const templates = findTemplates(content, templateName, page.title);

  if (!templates || templates.length === 0) {
    console.log(`No template ${templateName} found in ${page.title}`);
    return;
  }

  let hasAnyChanges = false;
  for (const template of templates) {
    const newTemplate = processTemplate(template, config);
    if (newTemplate) {
      newContent = newContent.replace(template, newTemplate);
      hasAnyChanges = true;
    }
  }

  if (hasAnyChanges) {
    await api.edit(
      page.title,
      `הסבת פרמטרים בתבנית ${templateName} ([[מיוחד:הבדל/42406592|בקשה בוק:בב]], [[מיוחד:הבדל/42406579|דיון בוק:תב]])`,
      newContent,
      revid,
    );
    console.log(`Updated ${page.title}`);
  } else {
    console.log(`No changes needed for ${page.title}`);
  }
}

export default async function updateMediaTemplates1() {
  const api = WikiApi();
  await api.login();

  for (const [templateName, config] of Object.entries(TEMPLATE_CONFIGS)) {
    console.log(`\nProcessing template: ${templateName}\n`);

    const generator = api.getArticlesWithTemplate(templateName, undefined, undefined, '*');

    await asyncGeneratorMapWithSequence(
      1,
      generator,
      (page) => async () => {
        try {
          await processArticle(api, page, templateName, config);
        } catch (error) {
          console.error(`Error processing ${page.title}:`, error);
        }
      },
    );

    console.log(`\nFinished processing template: ${templateName}\n`);
  }

  console.log('\nAll templates processed!\n');
}
