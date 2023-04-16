/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import { info, login } from '../wikiAPI';
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
  'תבנית:ציטוט יומי',
  'תבנית:תמונה מומלצת',
  'תבנית:הידעת?',
  'תבנית:ערך מומלץ',
];

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export async function main() {
  await login();
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
      const templatesInfo = await info(monthDates.map((date) => `${template} ${date}`));
      templatesInfo.forEach((templateInfo) => {
        if (('missing' in templateInfo) || !templateInfo.title) {
          return;
        }
        const editProtect = templateInfo.protection?.some((protection) => protection.type === 'edit');
        const moveProtect = templateInfo.protection?.some((protection) => protection.type === 'move');
        if (!editProtect || !moveProtect) {
          needToProtect.push(templateInfo.title);
        }
      });
    }));
  }));
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
