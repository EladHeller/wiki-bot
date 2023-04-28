/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import {
  deletePage, getRedirects, listCategory, login,
} from '../wiki/wikiAPI';
import { WikiPage } from '../types';
import { promiseSequence } from '../utilities';
import writeAdminBotLogs, { ArticleLog } from './log';

async function deleteRedirects(from: number, to: number[], title: string, reason: string) {
  const generator = getRedirects(from, to);
  const all: WikiPage[] = [];
  const errors: string[] = [];
  let res;
  try {
    do {
      res = await generator.next();
      const batch: WikiPage[] = Object.values(res.value?.query?.pages ?? {});
      const relevent = batch.filter((x) => x.links?.length === 1);
      all.push(...relevent);
      await promiseSequence(10, relevent.map((p: WikiPage) => async () => {
        try {
          await deletePage(p.title, reason);
        } catch (error) {
          errors.push(p.title);
          console.log(error?.data || error?.message || error?.toString());
        }
      }));
    } while (!res.done);
  } catch (error) {
    console.log(error?.data || error?.message || error?.toString());
  }
  const unique = all.filter((v, i, a) => a.findIndex((t) => t.title === v.title) === i);
  const logs: ArticleLog[] = unique.map((x) => {
    const error = errors.includes(x.title);
    const skipped = x.links?.length !== 1;
    return {
      text: `[[${x.title}]] ${x.links?.length === 1 ? ` {{כ}}← [[${x.links?.[0].title}]]` : 'לא ברור'}${error ? ' - שגיאה' : ''}`,
      error,
      skipped,
    };
  });
  return logs;
}

async function deleteInCategory(category: string, reason: string, match?: RegExp) {
  const generator = listCategory(category);
  let res;
  const logs: ArticleLog[] = [];
  try {
    do {
      res = await generator.next();
      const batch: WikiPage[] = res.value?.query.categorymembers ?? [];
      await promiseSequence(10, batch.map((p: WikiPage) => async () => {
        if (match && !p.title.match(match)) {
          logs.push({
            text: `[[${p.title}]]`,
            skipped: true,
          });
          return;
        }
        try {
          await deletePage(p.title, reason);
          logs.push({
            text: `[[${p.title}]]`,
          });
        } catch (error) {
          logs.push({
            text: `[[${p.title}]]`,
            error: true,
          });
          console.log(error?.data || error?.message || error?.toString());
        }
      }));
    } while (!res.done);
  } catch (error) {
    console.log(error?.data || error?.message || error?.toString());
  }
  return logs;
}

export async function main() {
  await login();
  console.log('logged in');
  const convertLogs = await deleteInCategory('ויקיפדיה/בוט/בוט ההסבה/דפי פלט/למחיקה', 'דף פלט של בוט ההסבה', /\/דוגמאות|\/פלט/);
  const logs: ArticleLog[] = [];
  logs.push(...(await deleteRedirects(119, [1], 'user:Sapper-bot/הפניות שיחה טיוטה לשיחה', 'הפניה ממרחב שיחת טיוטה למרחב השיחה')));
  logs.push(...(await deleteRedirects(118, [0], 'user:Sapper-bot/הפניות טיוטה לראשי', 'הפניה ממרחב הטיוטה למרחב הערכים')));
  logs.push(...(await deleteRedirects(3, [1], 'user:Sapper-bot/הפניות שיחת משתמש לשיחה', 'הפניה ממרחב שיחת משתמש למרחב שיחה')));
  logs.push(...(await deleteRedirects(0, [2, 118], 'user:Sapper-bot/הפניות ראשי למשתמש או טיוטה', 'הפניה ממרחב ראשי למרחב טיוטה')));
  await writeAdminBotLogs(logs, 'משתמש:Sapper-bot/מחיקת הפניות חוצות מרחבי שם');
  await writeAdminBotLogs(convertLogs, 'משתמש:Sapper-bot/מחיקת דפי פלט של בוט ההסבה');
}
