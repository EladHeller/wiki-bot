import { JSDOM } from 'jsdom';
import { hebrewGimetriya, promiseSequence } from '../../../utilities';
import BaseWikiApi, { defaultConfig } from '../../../wiki/BaseWikiApi';
import { findTemplates, getTemplateArrayData, templateFromArrayData } from '../../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../../wiki/WikiApi';

const ERRORS_PAGE = 'משתמש:Sapper-bot/שגיאות קריאה לתבניות ספרי קודש';

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

async function getWikisourceText(wikisourceAPI: IWikiApi, title: string): Promise<string> {
  try {
    const parsedContent = await wikisourceAPI.parsePage(title);
    const dom = new JSDOM(parsedContent);
    return dom.window.document.body.textContent?.replaceAll(/ [א-ת]+ \[([^\]]+)\]/g, ' $1') || '';
  } catch {
    console.error('Failed to get content', title);
    return '';
  }
}

export async function textExistsInTitle(wikisourceAPI: IWikiApi, title: string, text: string): Promise<boolean> {
  const content = await getWikisourceText(wikisourceAPI, title);
  return content.includes(text);
}

export async function tryTanachReplaces(
  wikisourceAPI: IWikiApi,
  title: string,
  content: string,
  errors: string[],
): Promise<string> {
  const relevantErrors = errors.filter((error) => error.includes(`[[${title}]]`));
  if (relevantErrors.length === 0) {
    return content;
  }
  let newContent = content;
  let replaceChapter = false;
  let replaceTemplate = false;
  let aOrB = false;
  if (relevantErrors.some((error) => error.includes('בקריאה לתבנית:תנ"ך') && (error.includes('אין פסוק') || error.includes('אין פרק')))) {
    replaceChapter = true;
  }
  if (relevantErrors.some((error) => error.includes('בקריאה לתבנית:תנ"ך') && error.includes('אין ספר') && error.includes(' א או '))) {
    aOrB = true;
  }
  if (relevantErrors.some((error) => error.includes('בקריאה לתבנית:תנ"ך') && error.includes('אין ספר') && !error.includes(' א או '))) {
    replaceTemplate = true;
  }
  if (!replaceChapter && !replaceTemplate && !aOrB) {
    return content;
  }
  const templates = findTemplates(content, TANACH_CITE_TEMPLATE, title);
  await promiseSequence(10, templates.map((template) => async () => {
    const arrayData = getTemplateArrayData(template, TANACH_CITE_TEMPLATE, title);
    const bareText = arrayData[0].replace(/["'().,;:]/g, '').replace(/[־-]/g, ' ').replace(/[\u0591-\u05C7]/g, '');
    if (arrayData.length !== 4) {
      return;
    }

    let exists = await textExistsInTitle(wikisourceAPI, `קטגוריה:${arrayData[1]} ${arrayData[2]} ${arrayData[3]}`, bareText);
    if (exists) {
      return;
    }
    if (aOrB) {
      const existsA = await textExistsInTitle(wikisourceAPI, `קטגוריה:${arrayData[1]} א ${arrayData[2]} ${arrayData[3]}`, bareText);
      const existsB = await textExistsInTitle(wikisourceAPI, `קטגוריה:${arrayData[1]} ב ${arrayData[2]} ${arrayData[3]}`, bareText);
      if (existsA || existsB) {
        const newTemplate = templateFromArrayData(
          [
            arrayData[0],
            arrayData[1] + (existsA ? ' א' : ' ב'),
            arrayData[2],
            arrayData[3],
          ],
          TANACH_CITE_TEMPLATE,
        );
        newContent = newContent.replace(template, newTemplate);
      }
      return;
    }
    if (replaceChapter) {
      exists = await textExistsInTitle(wikisourceAPI, `קטגוריה:${arrayData[1]} ${arrayData[3]} ${arrayData[2]}`, bareText);
      if (exists) {
        const newTemplate = templateFromArrayData(
          [
            arrayData[0],
            arrayData[1],
            arrayData[3],
            arrayData[2],
          ],
          TANACH_CITE_TEMPLATE,
        );
        newContent = newContent.replace(template, newTemplate);
        return;
      }
    }
    if (replaceTemplate) {
      exists = await textExistsInTitle(wikisourceAPI, `משנה ${arrayData[1]} ${arrayData[2]} ${arrayData[3]}`, bareText);
      if (exists) {
        const newTemplate = templateFromArrayData(
          [
            arrayData[0],
            arrayData[1],
            arrayData[2],
            arrayData[3],
          ],
          MISHNA_CITE_TEMPLATE,
        );
        newContent = newContent.replace(template, newTemplate);
        return;
      }
      exists = await textExistsInTitle(wikisourceAPI, `${arrayData[1]} ${arrayData[2]} ${arrayData[3]}`, bareText);
      if (exists) {
        const newTemplate = templateFromArrayData(
          [
            arrayData[0],
            arrayData[1],
            arrayData[2],
            arrayData[3],
          ],
          BAVLI_CITE_TEMPLATE,
        );
        newContent = newContent.replace(template, newTemplate);
      }
    }
  }));
  return newContent;
}

async function tryMishnaReplaces(
  wikisourceAPI: IWikiApi,
  title: string,
  content: string,
  errors: string[],
): Promise<string> {
  const relevantErrors = errors.filter((error) => error.includes(`[[${title}]]`));
  if (relevantErrors.length === 0) {
    return content;
  }
  let newContent = content;
  const thereAreErrors = relevantErrors.some((error) => error.includes('בקריאה לתבנית:משנה'));
  if (!thereAreErrors) {
    return content;
  }
  const templates = findTemplates(content, MISHNA_CITE_TEMPLATE, title);
  await promiseSequence(10, templates.map((template) => async () => {
    const arrayData = getTemplateArrayData(template, MISHNA_CITE_TEMPLATE, title);
    const bareText = arrayData[0].replace(/["'().,;:]/g, '').replace(/[־-]/g, ' ').replace(/[\u0591-\u05C7]/g, '');
    if (arrayData.length !== 4) {
      return;
    }

    let exists = await textExistsInTitle(wikisourceAPI, `משנה ${arrayData[1]} ${arrayData[2]} ${arrayData[3]}`, bareText);
    if (exists) {
      return;
    }
    exists = await textExistsInTitle(wikisourceAPI, `משנה ${arrayData[1]} ${arrayData[3]} ${arrayData[2]}`, bareText);
    if (exists) {
      const newTemplate = templateFromArrayData(
        [
          arrayData[0],
          arrayData[1],
          arrayData[3],
          arrayData[2],
        ],
        MISHNA_CITE_TEMPLATE,
      );
      newContent = newContent.replace(template, newTemplate);
      return;
    }
    exists = await textExistsInTitle(wikisourceAPI, `${arrayData[1]} ${arrayData[2]} ${arrayData[3]}`, bareText);
    if (exists) {
      const newTemplate = templateFromArrayData(
        [
          arrayData[0],
          arrayData[1],
          arrayData[2],
          arrayData[3],
        ],
        BAVLI_CITE_TEMPLATE,
      );
      newContent = newContent.replace(template, newTemplate);
    }
  }));
  return newContent;
}

export default async function fixCiteTemplateErrors() {
  const baseWiki = BaseWikiApi({
    ...defaultConfig,
    baseUrl: 'https://he.wiktionary.org/w/api.php',
  });

  const api = WikiApi(baseWiki);
  const wikisourceBaseApi = BaseWikiApi({
    ...defaultConfig,
    assertBot: false,
    baseUrl: 'https://he.wikisource.org/w/api.php',
  });
  const wikisourceApi = WikiApi(wikisourceBaseApi);
  const { content: errorPageContent } = await api.articleContent(ERRORS_PAGE);
  const errors = errorPageContent.split('\n');
  const generator = api.categroyPages('שגיאות קריאה לתבניות ספרי קודש', 10);
  for await (const pages of generator) {
    for (const page of pages) {
      const content = page.revisions?.[0].slots.main['*'];
      const revid = page.revisions?.[0].revid;
      if (!content || !revid) {
        throw new Error(`Missing content or revid ${page.title}`);
      }
      let newContent = fixGeneralErrors(page.title, content);
      newContent = await tryMishnaReplaces(wikisourceApi, page.title, newContent, errors);
      if (newContent !== content) {
        console.log('Updating', page.title);
        await api.edit(page.title, 'תיקון שגיאות קריאה לתבניות ספרי קודש', newContent, revid);
      }
    }
  }
}
