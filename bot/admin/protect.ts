/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import { getLocalDate, promiseSequence } from '../utilities';
import writeAdminBotLogs from './log';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { ArticleLog } from './types';
import pagesWithoutProtectInMainPage from './pagesWithoutProtectInMainPage';
import pagesWithCopyrightIssuesInMainPage from './pagesWithCopyrightIssuesInMainPage';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';

function getMonthTemplates(month: number, year: number, startWithDay = 1) {
  const dates: string[] = [];
  for (let i = startWithDay; i <= 31; i += 1) {
    const date = getLocalDate(`${year}-${month}-${i}`);
    if (date.startsWith(i.toString())) {
      dates.push(getLocalDate(`${year}-${month}-${i}`));
    }
  }
  return dates;
}

const templates = [
  'תבנית:הידעת?',
  'תבנית:ערך מומלץ',
  'תבנית:ציטוט יומי',
  'תבנית:תמונה מומלצת',
];

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

async function needProtectFromTitles(api: IWikiApi, titles :string[]): Promise<string[]> {
  const templatesInfo = await api.info(titles);
  return templatesInfo
    .filter((templateInfo) => {
      if (('missing' in templateInfo) || !templateInfo.title) {
        return false;
      }
      const editProtect = templateInfo.protection?.some(({ level, type, expiry }) => type === 'edit' && level !== 'autoconfirmed' && expiry === 'infinity');
      const moveProtect = templateInfo.protection?.some(({ level, type, expiry }) => type === 'move' && level !== 'autoconfirmed' && expiry === 'infinity');
      return (!editProtect || !moveProtect);
    })
    .map<string>(({ title }) => title || '');
}

async function getTemplatesByDate(api: IWikiApi) {
  const needToProtect: string[] = [];
  const currMonth = new Date().getMonth() + 1;
  const currDay = new Date().getDate();
  const currYear = new Date().getFullYear();
  const nextYear = currYear + 1;

  await Promise.all(months.map(async (month) => {
    const monthDates = getMonthTemplates(
      month,
      month < currMonth ? nextYear : currYear,
      month === currMonth ? currDay : 1,
    );
    await Promise.all(templates.map(async (template) => {
      const needProtection = await needProtectFromTitles(api, monthDates.map((date) => `${template} ${date}`));
      needToProtect.push(...needProtection);
    }));
  }));
  return needToProtect;
}

async function getTemplatesByCategory(api: IWikiApi, category: string, exceptCategryFormat?: string) {
  const generator = api.listCategory(category);
  let res: IteratorResult<any, void>;
  const needToProtect: string[] = [];
  do {
    res = await generator.next();
    const pages = res.value?.query?.categorymembers ?? [];
    const relevent = pages.filter((page: any) => !page.sortkeyprefix.startsWith('*')) ?? [];
    const releventToProtect = relevent.filter((page) => !page.title.startsWith('קטגוריה:'));
    const batches: any[] = [];
    for (let i = 0; i < releventToProtect.length; i += 25) {
      batches.push(releventToProtect.slice(i, i + 25));
    }
    await promiseSequence(10, batches.map((batch) => async () => {
      const needProtection = await needProtectFromTitles(api, batch.map((page: any) => page.title));
      needToProtect.push(...needProtection);
    }));
    const categories = relevent
      .filter((page: any) => page.title.startsWith('קטגוריה:') && (!exceptCategryFormat || !page.title.includes(exceptCategryFormat)))
      .map(({ title }) => title.replace('קטגוריה:', ''));
    for (const cat of categories) {
      console.log(`Getting ${cat}`);
      const categoryNeedToProtect = await getTemplatesByCategory(api, cat);
      needToProtect.push(...categoryNeedToProtect);
    }
  } while (!res?.done);
  return needToProtect;
}
export async function protectBot() {
  const api = WikiApi();
  await api.login();
  const didYouKnowTemplates = await getTemplatesByCategory(api, 'תבניות הידעת?');
  let needToProtect = didYouKnowTemplates.filter((template) => template.startsWith('תבנית:הידעת?'));
  const portalTemplates = await getTemplatesByCategory(api, 'פורטלים: קטעי "ערך מומלץ"');
  needToProtect = needToProtect.concat(portalTemplates.filter(
    (template) => template.startsWith('פורטל:ערכים מומלצים/ערכים') || template.startsWith('תבנית:ערך מומלץ'),
  ));
  const articleGroups = await getTemplatesByCategory(api, 'תבניות ניווט - מקבצי ערכים');
  needToProtect = needToProtect.concat(articleGroups.filter((template) => template.startsWith('תבנית:מקבץ ערכים')));
  const dailyQuoteTemplates = await getTemplatesByCategory(api, 'תבניות ציטוט יומי');
  needToProtect = needToProtect.concat(
    dailyQuoteTemplates.filter((template) => template.match(/ציטוט יומי \d{1,2} ב[א-ת]{3,7} \d{4}/)),
  );
  const recomendedImages = await getTemplatesByCategory(api, 'תבניות תמונה מומלצת');
  needToProtect = needToProtect.concat(
    recomendedImages.filter((template) => template.match(/תמונה מומלצת \d{1,2} ב[א-ת]{3,7} \d{4}/)),
  );

  const templatesByDate = await getTemplatesByDate(api);
  needToProtect = needToProtect.concat(templatesByDate);

  const allConvertPages = await getTemplatesByCategory(api, 'ויקיפדיה/בוט/בוט ההסבה/דפי מפרט', 'ויקיפדיה/בוט/בוט ההסבה/דפי פלט');
  const convertPages = allConvertPages
    .filter((template) => template.startsWith('שיחת תבנית:')
      || template.startsWith('שיחת קטגוריה:')
      || template.includes('הסבה')
      || template.includes('הסרה')
      || template.includes('הסרת')
      || template.includes('תיקון')
      || template.includes('דפים')
      || template.includes('הסבת')
      || template.includes('פרמטר')
      || template.includes('ניקיון')
      || template.includes('שאילתות')
    || template.startsWith('משתמש:בורה בורה/')
    || template.startsWith('משתמש:עמד/')
    || template.startsWith('משתמש:Kotz/'));

  const errors: string[] = [];
  for (const title of needToProtect) {
    try {
      console.log(`Protecting ${title}`);
      await api.protect(title, 'edit=editautopatrolprotected|move=editautopatrolprotected', 'never', 'מופיע בעמוד הראשי');
    } catch (e) {
      console.log(`Failed to protect ${title}`);
      console.error(e);
      errors.push(title);
    }
  }
  const convertErrors: string[] = [];
  for (const title of convertPages) {
    try {
      console.log(`Protecting ${title}`);
      await api.protect(title, 'edit=editautopatrolprotected|move=editautopatrolprotected', 'never', 'דפי מפרט של בוט ההסבה');
    } catch (e) {
      console.log(`Failed to protect ${title}`);
      console.error(e);
      convertErrors.push(title);
    }
  }

  if (allConvertPages.length) {
    const logs: ArticleLog[] = allConvertPages.map((title) => {
      const skipped = !convertPages.includes(title);
      const error = convertErrors.includes(title);
      return {
        title,
        text: `[[${title}]]`,
        skipped,
        error,
      };
    });
    await writeAdminBotLogs(api, logs, 'משתמש:Sapper-bot/הגנת דפי מפרט של בוט ההסבה');
  }
  const needProtectLogs = await pagesWithoutProtectInMainPage();
  if (needToProtect.length || needProtectLogs.length) {
    const logs: ArticleLog[] = needToProtect.map((title) => {
      const error = errors.includes(title);
      return {
        title,
        text: `[[${title}]]`,
        error,
      };
    });
    await writeAdminBotLogs(api, [...logs, ...needProtectLogs], 'משתמש:Sapper-bot/הגנת דפים שמופיעים בעמוד הראשי');
  }

  const pagesWithCopyrightIssues = await pagesWithCopyrightIssuesInMainPage();

  if (pagesWithCopyrightIssues.length) {
    await writeAdminBotLogs(api, pagesWithCopyrightIssues, 'משתמש:Sapper-bot/זכויות יוצרים');
  }
}
export const main = shabathProtectorDecorator(protectBot);
