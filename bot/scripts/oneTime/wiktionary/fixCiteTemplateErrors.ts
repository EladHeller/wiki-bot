import { JSDOM } from 'jsdom';
import { hebrewGimetriya } from '../../../utilities';
import BaseWikiApi, { defaultConfig } from '../../../wiki/BaseWikiApi';
import { findTemplates, getTemplateArrayData, templateFromArrayData } from '../../../wiki/newTemplateParser';
import WikiApi from '../../../wiki/WikiApi';

const TANACH_CITE_TEMPLATE = 'צט/תנ"ך';
const MISHNA_CITE_TEMPLATE = 'צט/משנה';
const BAVLI_CITE_TEMPLATE = 'צט/בבלי';
const YERUSHALMI_CITE_TEMPLATE = 'צט/ירושלמי';
const YERUSALMI_HALACHA_CITE_TEMPLATE = 'צט/ירושלמי הלכה';
const TOSEFTA_CITE_TEMPLATE = 'צט/תוספתא';
const MIDRASH_CITE_TEMPLATE = 'צט/מדרש';
const YONATAN_CITE_TEMPLATE = 'צט/יהונתן';
const TARGUM_CITE_TEMPLATE = 'צט/תרגום';
const replaces = {
  ביכורים: 'בכורים',
  ידיים: 'ידים',
  מקוואות: 'מקואות',
  מידות: 'מדות',
  עדויות: 'עדיות',
  יהושוע: 'יהושע',
  'מגלת אסתר': 'אסתר',
  נדה: 'נידה',
  'דברי־הימים': 'דברי הימים',
  ישׁעיה: 'ישעיה',
  בראשתי: 'בראשית',
  דנייאל: 'דניאל',
  קוהלת: 'קהלת',
  בראשת: 'בראשית',
  תילים: 'תהילים',
  תבלים: 'תהלים',
  'נלכים א': 'מלכים א',
  נגעי: 'נגעים',
  כלאיים: 'כלאים',
  'פרקי אבות': 'אבות',
  מכשירים: 'מכשירין',
  גטין: 'גיטין',
  ביצא: 'ביצה',
  יוצא: 'יומא',
  'עבוזה זרה': 'עבודה זרה',
  תרומו: 'תרומות',
  'מוע קטן': 'מועד קטן',
};

const charsToReplace = ['"', "'", ')', '(', '.', ',', 'מסכת ', 'פרק ', 'פסוק ', 'דף ', 'עמוד ', 'סימן ', 'סעיף ', 'משנה ', 'ספר '];
function fixGeneralErrors(title: string, content: string): string {
  const templateNames = [TANACH_CITE_TEMPLATE, MISHNA_CITE_TEMPLATE, BAVLI_CITE_TEMPLATE, YERUSHALMI_CITE_TEMPLATE,
    TOSEFTA_CITE_TEMPLATE, YERUSALMI_HALACHA_CITE_TEMPLATE, MIDRASH_CITE_TEMPLATE, YONATAN_CITE_TEMPLATE,
    TARGUM_CITE_TEMPLATE];

  let newContent = content;
  let changed = false;
  templateNames.forEach((templateName) => {
    const templates = findTemplates(content, templateName, title);
    templates.forEach((template) => {
      const arrayData = getTemplateArrayData(template, templateName, title);
      for (let i = 1; i < arrayData.length; i += 1) {
        if (charsToReplace.some((char) => arrayData[i].includes(char))) {
          changed = true;
          arrayData[i] = arrayData[i].replace(/["'().,]/g, '');
          for (const char of charsToReplace) {
            arrayData[i] = arrayData[i].replace(char, '');
          }
        }
        if (arrayData[i].match(/^\d+$/)) {
          changed = true;
          arrayData[i] = hebrewGimetriya(Number(arrayData[i]));
        }
        if (replaces[arrayData[i]]) {
          changed = true;
          arrayData[i] = replaces[arrayData[i]];
        }
      }
      const newTemplate = templateFromArrayData(arrayData, templateName);
      newContent = newContent.replace(template, newTemplate);
    });
  });

  return changed ? newContent : content;
}

export async function listAllErrors() {
  const baseWiki = BaseWikiApi({
    ...defaultConfig,
    baseUrl: 'https://he.wiktionary.org/w/api.php',
  });
  const api = WikiApi(baseWiki);
  await api.login();

  const [info] = await api.info(['user:Sapper-bot/שגיאות קריאה לתבניות ספרי קודש']);
  const revid = info.lastrevid;
  if (!revid) {
    throw new Error('Failed to get last revision id');
  }
  const generator = api.categroyTitles('שגיאות קריאה לתבניות ספרי קודש');
  const errors: {error: string, title: string}[] = [];
  for await (const pages of generator) {
    for (const page of pages) {
      const parsedContent = await api.parsePage(page.title);
      const dom = new JSDOM(parsedContent);
      const errorElements = dom.window.document.querySelectorAll('.scribunto-error');
      errorElements.forEach((errorElement) => {
        if (errorElement.textContent?.includes('שגיאת לואה')) {
          errors.push({ error: errorElement.textContent, title: page.title });
        }
      });
    }
  }
  await api.edit(
    'user:Sapper-bot/שגיאות קריאה לתבניות ספרי קודש',
    'שגיאות קריאה לתבניות ספרי קודש',
    errors.map(({ error, title }) => `* [[${title}]]: ${error}`).join('\n'),
    revid,
  );
}

export default async function fixCiteTemplateErrors() {
  const baseWiki = BaseWikiApi({
    ...defaultConfig,
    baseUrl: 'https://he.wiktionary.org/w/api.php',
  });
  const api = WikiApi(baseWiki);
  await api.login();
  const generator = api.categroyPages('שגיאות קריאה לתבניות ספרי קודש', 10);
  for await (const pages of generator) {
    for (const page of pages) {
      const content = page.revisions?.[0].slots.main['*'];
      const revid = page.revisions?.[0].revid;
      if (!content || !revid) {
        throw new Error(`Missing content or revid ${page.title}`);
      }
      const newContent = fixGeneralErrors(page.title, content);
      if (newContent !== content) {
        console.log('Updating', page.title);
        await api.edit(page.title, 'תיקון שגיאות קריאה לתבניות ספרי קודש', newContent, revid);
      }
    }
  }
}
