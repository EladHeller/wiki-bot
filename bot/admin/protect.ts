import 'dotenv/config';
import { login, protect } from '../wikiAPI';
import { getLocalDate } from '../utilities';

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

async function main() {
  await login();
  getMonthTemplates(5, 2023).forEach((date) => {
    console.log(`תבנית:ציטוט יומי ${date}`);
    console.log(`תבנית:תמונה מומלצת ${date}`);
    console.log(`תבנית:הידעת? ${date}`);
    console.log(`תבנית:ערך מומלץ ${date}`);
  });
  const nextWeekTimeStamp = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
  const res = await protect('user:test/test', 'edit=autopatrol|move=autopatrol', nextWeekTimeStamp.toString(), 'בדיקה');
  console.log(res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
