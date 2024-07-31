/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import {
  deletePage, getRedirects, getRevisions, listCategory, login,
} from '../wiki/wikiAPI';
import { WikiPage } from '../types';
import { promiseSequence } from '../utilities';
import writeAdminBotLogs from './log';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { ArticleLog } from './types';

const fixBrokenRedirectsBotName = 'EmausBot';

async function deleteRedirects(from: number, to: number[], reasons: string[], delayDays = 0) {
  const generator = getRedirects(from, to);
  const all: WikiPage[] = [];
  const errors: string[] = [];
  const mutlyRevisions: WikiPage[] = [];
  let res;
  try {
    do {
      res = await generator.next();
      const batch: WikiPage[] = Object.values(res.value?.query?.pages ?? {});
      const relevent = batch.filter((x) => {
        const timestamp = x.revisions?.[0]?.timestamp;
        if (!timestamp) {
          return false;
        }
        const date = new Date(timestamp);
        const now = new Date();
        date.setDate(date.getDate() + delayDays);
        const isDelay30Days = date < now;
        return x.links?.length === 1 && x.templates == null && x.categories == null && isDelay30Days;
      });
      all.push(...relevent);
      await promiseSequence(10, relevent.map((p: WikiPage) => async () => {
        try {
          const reveisionRes = await getRevisions(p.title, 2);
          const revisionsLength = reveisionRes.revisions?.length;
          if (revisionsLength === 1
            || (revisionsLength === 2 && reveisionRes.revisions?.[0].user === fixBrokenRedirectsBotName)) {
            const reason = reasons[to.indexOf(p.links?.[0].ns || 0)] ?? reasons[0];
            const target = p.links?.[0].title;
            await deletePage(p.title, reason + (target ? ` - [[${target}]]` : ''));
          } else {
            mutlyRevisions.push(p);
          }
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
    const skipped = x.links?.length !== 1 || x.templates != null || x.categories != null
     || mutlyRevisions.includes(x);
    return {
      title: x.title,
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
            title: p.title,
            text: `[[${p.title}]]`,
            skipped: true,
          });
          return;
        }
        try {
          await deletePage(p.title, reason);
          logs.push({
            title: p.title,
            text: `[[${p.title}]]`,
          });
        } catch (error) {
          logs.push({
            title: p.title,
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

export default async function deleteBot() {
  await login();
  console.log('logged in');
  const convertLogs = await deleteInCategory('ויקיפדיה/בוט/בוט ההסבה/דפי פלט/למחיקה', 'דף פלט של בוט ההסבה', /\/דוגמאות|\/פלט|^שיחת ויקיפדיה:בוט\/בוט ההסבה\//);
  // const jewishEncyclopdia = await deleteInCategory(
  //   'ויקיפדיה - ערכים למחיקה ממיזם האנציקלופדיה היהודית',
  //   'דף למחיקה - מיזם האנציקלופדיה היהודית',
  //   /^(שיחת )?ויקיפדיה:מיזמי ויקיפדיה\/אתר האנציקלופדיה היהודית\
  // /(מיון נושאים: לוויקי|ערכים שנוצרו באנציקלופדיה היהודית)\//,
  // );
  const logs: ArticleLog[] = [];
  logs.push(...(await deleteRedirects(119, [1], ['הפניה ממרחב שיחת טיוטה למרחב השיחה'], 30)));
  logs.push(...(await deleteRedirects(118, [0], ['הפניה ממרחב הטיוטה למרחב הערכים'], 30)));
  logs.push(...(await deleteRedirects(3, [1], ['הפניה ממרחב שיחת משתמש למרחב שיחה'], 30)));
  logs.push(...(await deleteRedirects(0, [2, 118], [
    'הפניה ממרחב ראשי למרחב משתמש', 'הפניה ממרחב ראשי למרחב טיוטה'])));
  await writeAdminBotLogs(logs, 'משתמש:Sapper-bot/מחיקת הפניות חוצות מרחבי שם');
  await writeAdminBotLogs(convertLogs, 'משתמש:Sapper-bot/מחיקת דפי פלט של בוט ההסבה');
  // await writeAdminBotLogs(jewishEncyclopdia,
  // 'משתמש:Sapper-bot/מחיקת דפים מיותרים במיזם האנציקלופדיה היהודית');
}

export const main = shabathProtectorDecorator(deleteBot);
