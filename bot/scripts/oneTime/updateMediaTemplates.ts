import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const TEMPLATE_CONFIGS = {
  עיתון: {
    renames: {
      'תאריך ייסוד': 'תאריך התחלה',
      'תאריך סגירה': 'תאריך סיום',
    },
    deletes: ['מין'],
  },
  ערוץ: {
    renames: {
      'תאריך השקה': 'תאריך התחלה',
      'תאריך סגירה': 'תאריך סיום',
      בעלות: 'בעלים',
      'משרד ראשי': 'מערכת',
      קטגוריה: 'סוגה',
      הוט: 'אפיק הוט',
      יס: 'אפיק יס',
      סלקום: 'אפיק סלקום',
      פרטנר: 'אפיק פרטנר',
      'עידן פלוס': 'אפיק עידן פלוס',
    },
    deletes: [],
  },
  'תחנת רדיו': {
    renames: {
      קטגוריה: 'סוגה',
      בעלות: 'בעלים',
      'אפיק HOT': 'אפיק הוט',
      'אפיק yes': 'אפיק יס',
    },
    deletes: [],
  },
};

function processTemplate(
  template: string,
  config: typeof TEMPLATE_CONFIGS[keyof typeof TEMPLATE_CONFIGS],
): string {
  const originalKeyValueData = getTemplateKeyValueData(template);
  const keyValueData = { ...originalKeyValueData };

  for (const [oldKey, newKey] of Object.entries(config.renames)) {
    if (keyValueData[oldKey] !== undefined) {
      keyValueData[newKey] = keyValueData[oldKey];
      delete keyValueData[oldKey];
    }
  }

  for (const keyToDelete of config.deletes) {
    if (keyValueData[keyToDelete] !== undefined) {
      delete keyValueData[keyToDelete];
    }
  }

  for (const [key, value] of Object.entries(keyValueData)) {
    if (!value || value.trim() === '') {
      delete keyValueData[key];
    }
  }

  return templateFromKeyValueData(keyValueData, 'כלי תקשורת');
}

async function processArticle(
  api: IWikiApi,
  page: WikiPage,
  templateName: string,
  config: typeof TEMPLATE_CONFIGS[keyof typeof TEMPLATE_CONFIGS],
): Promise<void> {
  const { content, revid } = contentFromPage(page);

  if (!revid || !content) {
    console.log(`Missing revid or content for ${page.title}`);
    return;
  }

  let newContent = content.replace(`{{כלי תקשורת
|={{עיתון
}}`, '{{כלי תקשורת}}');
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
      `הסבת תבנית ${templateName} לתבנית כלי תקשורת ([[מיוחד:הבדל/42406592|בקשה בוק:בב]], [[מיוחד:הבדל/42406579|דיון בוק:תב]])`,
      newContent,
      revid,
    );
    console.log(`Updated ${page.title}`);
  } else {
    console.log(`No changes needed for ${page.title}`);
  }
}

export default async function updateMediaTemplates() {
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
