import { asyncGeneratorMapWithSequence } from '../../utilities';
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
  templateName: string,
  config: typeof TEMPLATE_CONFIGS[keyof typeof TEMPLATE_CONFIGS],
): { newTemplate: string; hasChanges: boolean } {
  const originalKeyValueData = getTemplateKeyValueData(template);
  const keyValueData = { ...originalKeyValueData };
  let hasChanges = false;

  for (const [oldKey, newKey] of Object.entries(config.renames)) {
    if (keyValueData[oldKey] !== undefined) {
      keyValueData[newKey] = keyValueData[oldKey];
      delete keyValueData[oldKey];
      hasChanges = true;
    }
  }

  for (const keyToDelete of config.deletes) {
    if (keyValueData[keyToDelete] !== undefined) {
      delete keyValueData[keyToDelete];
      hasChanges = true;
    }
  }

  for (const [key, value] of Object.entries(keyValueData)) {
    if (!value || value.trim() === '') {
      delete keyValueData[key];
      hasChanges = true;
    }
  }

  return {
    newTemplate: templateFromKeyValueData(keyValueData, templateName),
    hasChanges,
  };
}

async function processArticle(
  api: IWikiApi,
  page: any,
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
    const { newTemplate, hasChanges } = processTemplate(template, templateName, config);
    if (hasChanges) {
      newContent = newContent.replace(template, newTemplate);
      hasAnyChanges = true;
    }
  }

  if (hasAnyChanges) {
    await api.edit(
      page.title,
      `עדכון פרמטרים בתבנית ${templateName} ([[מיוחד:הבדל/42406592|בקשה בוק:בב]], [[מיוחד:הבדל/42406579|דיון בוק:תב]])`,
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

    const generator = api.getArticlesWithTemplate(templateName);

    await asyncGeneratorMapWithSequence(
      10,
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
