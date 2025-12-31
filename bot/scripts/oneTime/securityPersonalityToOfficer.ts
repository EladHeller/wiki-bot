import { WikiPage } from '../../types';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const OFFICER_TEMPLATE_NAME = 'נושא משרה';
const SECURITY_PERSONALITY_TEMPLATE_NAME = 'אישיות ביטחונית';

const fieldsToRename = {
  'התחלת פעילות': 'התחלת שירות',
  'סיום פעילות': 'סיום שירות',
  'תפקידים אזרחיים': 'תפקידים נוספים',
};

const classificationMapping: Record<string, { סיווג: string; 'סוג שירות': string }> = {
  חייל: { סיווג: 'צבאי', 'סוג שירות': 'צבאי' },
  חיילת: { סיווג: 'צבאי', 'סוג שירות': 'צבאי' },
  צבאי: { סיווג: 'צבאי', 'סוג שירות': 'צבאי' },
  שוטר: { סיווג: 'משטרה', 'סוג שירות': 'משטרתי' },
  שוטרת: { סיווג: 'משטרה', 'סוג שירות': 'משטרתי' },
  משטרה: { סיווג: 'משטרה', 'סוג שירות': 'משטרתי' },
  משטרתי: { סיווג: 'משטרה', 'סוג שירות': 'משטרתי' },
  מחבל: { סיווג: 'מחבל', 'סוג שירות': 'טרור' },
  מחבלת: { סיווג: 'מחבל', 'סוג שירות': 'טרור' },
};

const typesToConvertToServiceType = ['מוסד', 'שב"כ', 'מד"א'];

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

  const type = keyValueData['סיווג']?.trim();
  if (type) {
    if (classificationMapping[type]) {
      keyValueData['סיווג'] = classificationMapping[type]['סיווג'];
      keyValueData['סוג שירות'] = classificationMapping[type]['סוג שירות'];
    } else if (typesToConvertToServiceType.includes(type)) {
      keyValueData['סוג שירות'] = type;
      delete keyValueData['סיווג'];
    } else {
      delete keyValueData['סיווג'];
    }
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
      `הסבת תבנית ${SECURITY_PERSONALITY_TEMPLATE_NAME} לתבנית ${OFFICER_TEMPLATE_NAME} ([[מיוחד:הבדל/42456700|בקשה בוק:בב]], [[מיוחד:הבדל/42447855|דיון בוק:תב]])`,
      newContent,
      revid,
    );
  } else {
    console.log(`No changes needed for ${page.title}`);
  }
}

export default async function securityPersonalityToOfficer() {
  const api = WikiApi();
  await api.login();

  const generator = api.getArticlesWithTemplate(SECURITY_PERSONALITY_TEMPLATE_NAME, undefined, undefined, '*');
  let count = 0;

  for await (const pages of generator) {
    for (const page of pages) {
      count += 1;
      try {
        await processArticle(api, page);
      } catch (error) {
        console.error(`Error processing ${page.title}:`, error.message);
      }
      if (count >= 1000) {
        throw new Error('Stopped at 1000 pages');
      }
    }
  }

  console.log('\nAll security personalities processed!\n');
}
