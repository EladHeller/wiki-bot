import 'dotenv/config';
import { info, login } from '../wikiAPI';
import { getLocalDate } from '../utilities';
import { closePlaywright, loginWithPlaywright, protectWithPlaywrihgt } from './protectPlaywright';

// תבנית:ציטוט יומי 13 באפריל 2023
// קטגוריה:תבניות ציטוט יומי

// תבנית:תמונה מומלצת 13 באפריל 2023
// קטגוריה:תבניות תמונה מומלצת

// תבנית:הידעת? 13 באפריל 2023
// קטגוריה:הפניות יומיות לקטעי הידעת?

// קטגוריה:ויקיפדיה: תקצירי ערכים מומלצים: 2023
// תבנית:ערך מומלץ 13 באפריל 2023

// קטגוריה:תבניות הידעת?

// תבנית:התמונה המומלצת
//

function getMonthTemplates(month: number, year: number) {
  const dates: string[] = [];
  for (let i = 1; i <= 31; i += 1) {
    dates.push(getLocalDate(`${year}-${month}-${i}`));
  }
  return dates;
}

const templates = [
  'תבנית:ציטוט יומי',
  'תבנית:תמונה מומלצת',
  'תבנית:הידעת?',
  'תבנית:ערך מומלץ',
];
const months = [4];

async function main() {
  process.env.USER_NAME = process.env.PROTECT_USER_NAME;
  process.env.PASSWORD = process.env.PROTECT_PASSWORD;
  await login();
  const needToProtect: string[] = [];

  await Promise.all(months.map(async (month) => {
    const monthDates = getMonthTemplates(month, 2023);
    await Promise.all(templates.map(async (template) => {
      const templatesInfo = await info(monthDates.map((date) => `${template} ${date}`));
      templatesInfo.forEach((templateInfo) => {
        if (('missing' in templateInfo) || !templateInfo.title) {
          console.log(`Missing ${templateInfo.title}`);
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

  await loginWithPlaywright(process.env.BASE_USER_NAME || '');

  for (const title of needToProtect) {
    console.log(`Protecting ${title}`);
    await protectWithPlaywrihgt(title);
  }
  await closePlaywright();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
