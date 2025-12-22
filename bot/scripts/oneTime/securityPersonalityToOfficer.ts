import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const OFFICER_TEMPLATE_NAME = 'נושא משרה';
const SECURITY_PERSONALITY_TEMPLATE_NAME = 'אישיות בטחונית';

const fieldsToRename = {
  'התחלת פעילות': 'התחלת שירות',
  'סיום פעילות': 'סיום שירות',
  'תפקידים אזרחיים': 'תפקידים נוספים',
};

const typesToRename = {
  חייל: 'צבאי',
  חיילת: 'צבאי',
  שוטר: 'משטרה',
  שוטרת: 'משטרה',
  משטרתי: 'משטרה',
};
function processTemplate(
  template: string,
): string {
  const originalKeyValueData = getTemplateKeyValueData(template);
  const keyValueData = { ...originalKeyValueData };

  for (const [oldKey, newKey] of Object.entries(fieldsToRename)) {
    if (keyValueData[oldKey] !== undefined) {
      keyValueData[newKey] = keyValueData[oldKey];
      delete keyValueData[oldKey];
    }
  }
  const type = keyValueData['סיווג'];
  if (type && typesToRename[type]) {
    keyValueData['סיווג'] = typesToRename[type];
  }

  return templateFromKeyValueData(keyValueData, 'נושא משרה');
}

async function processArticle(
  api: IWikiApi,
  page: WikiPage,
): Promise<void> {
  const content = page.revisions?.[0]?.slots.main['*'];
  const revid = page.revisions?.[0]?.revid;

  if (!revid || !content) {
    console.log(`Missing revid or content for ${page.title}`);
    return;
  }

  let newContent = content;
  const templates = findTemplates(content, SECURITY_PERSONALITY_TEMPLATE_NAME, page.title);

  if (!templates || templates.length === 0) {
    console.log(`No template ${SECURITY_PERSONALITY_TEMPLATE_NAME} found in ${page.title}`);
    return;
  }

  let hasAnyChanges = false;
  for (const template of templates) {
    const newTemplate = processTemplate(template);
    if (newTemplate) {
      newContent = newContent.replace(template, newTemplate);
      hasAnyChanges = true;
    }
  }

  if (hasAnyChanges) {
    await api.edit(
      page.title,
      `הסבת תבנית ${SECURITY_PERSONALITY_TEMPLATE_NAME} לתבנית ${OFFICER_TEMPLATE_NAME} ([[מיוחד:הבדל/42406592|בקשה בוק:בב]], [[מיוחד:הבדל/42406579|דיון בוק:תב]])`,
      newContent,
      revid,
    );
    console.log(`Updated ${page.title}`);
  } else {
    console.log(`No changes needed for ${page.title}`);
  }
}

export default async function securityPersonalityToOfficer() {
  const api = WikiApi();
  await api.login();

  const generator = api.getArticlesWithTemplate(SECURITY_PERSONALITY_TEMPLATE_NAME, undefined, undefined, '*');

  await asyncGeneratorMapWithSequence(
    1,
    generator,
    (page) => async () => {
      try {
        await processArticle(api, page);
      } catch (error) {
        console.error(`Error processing ${page.title}:`, error);
      }
    },
  );

  console.log('\nAll security personalities processed!\n');
}
