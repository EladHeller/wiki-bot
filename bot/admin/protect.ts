/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import { info, listCategory, login } from '../wikiAPI';
import { getLocalDate } from '../utilities';
import { closePlaywright, loginWithPlaywright, protectWithPlaywrihgt } from './protectPlaywright';

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

async function needProtectFromTitles(titles :string[]): Promise<string[]> {
  const templatesInfo = await info(titles);
  return templatesInfo
    .filter((templateInfo) => {
      if (('missing' in templateInfo) || !templateInfo.title) {
        return false;
      }
      const editProtect = templateInfo.protection?.some(({ level, type, expiry }) => type === 'edit' && level !== 'autoconfirmed' && expiry === 'infinity');
      const moveProtect = templateInfo.protection?.some(({ level, type, expiry }) => type === 'edit' && level !== 'autoconfirmed' && expiry === 'infinity');
      return (!editProtect || !moveProtect);
    })
    .map<string>(({ title }) => title || '');
}

async function getTemplatesByDate() {
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
      const needProtection = await needProtectFromTitles(monthDates.map((date) => `${template} ${date}`));
      needToProtect.push(...needProtection);
    }));
  }));
  return needToProtect;
}

async function getTemplatesByCategory(category: string) {
  const generator = listCategory(category);
  let res: IteratorResult<any, void>;
  const needToProtect: string[] = [];
  do {
    res = await generator.next();
    const relevent = res.value?.query?.categorymembers.filter((page: any) => !page.sortkeyprefix.startsWith('*')) ?? [];
    const batches: any[] = [];
    for (let i = 0; i < relevent.length; i += 30) {
      batches.push(relevent.slice(i, i + 30));
    }
    await Promise.all(batches.map(async (batch) => {
      const needProtection = await needProtectFromTitles(batch.map((page: any) => page.title));
      needToProtect.push(...needProtection);
    }));
  } while (!res?.done);
  return needToProtect;
}

export async function main() {
  await login();
  let needToProtect = await getTemplatesByCategory('תבניות הידעת?');
  const portalTemplates = await getTemplatesByCategory('פורטלים: קטעי "ערך מומלץ"');
  needToProtect = needToProtect.concat(portalTemplates.filter((template) => template.startsWith('פורטל:')));
  const articleGroups = await getTemplatesByCategory('תבניות ניווט - מקבצי ערכים');
  needToProtect = needToProtect.concat(articleGroups.filter((template) => template.startsWith('תבנית:')));
  const articleGroupsIsrael = await getTemplatesByCategory('תבניות ניווט - מקבצי ערכים לחגים עבריים');
  needToProtect = needToProtect.concat(articleGroupsIsrael.filter((template) => template.startsWith('תבנית:')));

  needToProtect = needToProtect.concat(await getTemplatesByDate());

  if (needToProtect.length === 0) {
    console.log('No need to protect');
    return;
  }

  await loginWithPlaywright(process.env.USER_NAME || '', process.env.PASSWORD || '');

  for (const title of needToProtect) {
    console.log(`Protecting ${title}`);
    await protectWithPlaywrihgt(title, 'מופיע בעמוד הראשי');
  }
  await closePlaywright();
}
