/* eslint-disable import/prefer-default-export */
import { WikiPage } from '../types';
import { asyncGeneratorMapWithSequence } from '../utilities';
import writeAdminBotLogs from './log';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { ArticleLog } from './types';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';

const fixBrokenRedirectsBotNames = ['EmausBot', 'Xqbot'];

async function deleteRedirects(api: IWikiApi, from: number, to: number, reasons: string[], delayDays = 0) {
  const generator = api.getRedirectsFrom(from, to, 500, 'תבנית:הפניה לא למחוק', 'קטגוריה:הפניות לא למחוק');
  const all: WikiPage[] = [];
  const errors: string[] = [];
  const mutlyRevisions: WikiPage[] = [];
  try {
    await asyncGeneratorMapWithSequence(10, generator, (p: WikiPage) => async () => {
      try {
        const timestamp = p.revisions?.[0]?.timestamp;
        if (!timestamp) {
          return;
        }
        if (p.ns !== from) {
          return;
        }
        const date = new Date(timestamp);
        const now = new Date();
        date.setDate(date.getDate() + delayDays);
        const isPassedDelayDays = date < now;
        if (p.links?.length !== 1 || p.templates != null || p.categories != null || !isPassedDelayDays) {
          return;
        }
        all.push(p);
        const revisions = await api.getArticleRevisions(p.title, 2, 'user');
        const revisionsLength = revisions?.length;
        const isRevisionsLengthValid = revisionsLength === 1
          || (revisionsLength === 2 && revisions?.[0].user
            && fixBrokenRedirectsBotNames.includes(revisions?.[0].user));
        if (!isRevisionsLengthValid) {
          mutlyRevisions.push(p);
          return;
        }
        const reason = reasons[0];
        const target = p.links?.[0].title;
        await api.deletePage(p.title, reason + (target ? ` - [[${target}]]` : ''));
      } catch (error) {
        errors.push(p.title);
        console.log(error?.data || error?.message || error?.toString());
      }
    });
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

async function deleteInCategory(api: IWikiApi, category: string, reason: string, match?: RegExp) {
  const logs: ArticleLog[] = [];
  try {
    const generator = api.listCategory(category);
    await asyncGeneratorMapWithSequence(10, generator, (p: WikiPage) => async () => {
      if (match && !p.title.match(match)) {
        logs.push({
          title: p.title,
          text: `[[${p.title}]]`,
          skipped: true,
        });
        return;
      }
      try {
        await api.deletePage(p.title, reason);
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
    });
  } catch (error) {
    console.log(error?.data || error?.message || error?.toString());
  }
  return logs;
}

export default async function deleteBot() {
  const api = WikiApi();
  await api.login();
  console.log('logged in');
  const convertLogs = await deleteInCategory(api, 'ויקיפדיה/בוט/בוט ההסבה/דפי פלט/למחיקה', 'דף פלט של בוט ההסבה', /\/דוגמאות|\/פלט|^שיחת ויקיפדיה:בוט\/בוט ההסבה\//);
  const logs: ArticleLog[] = [];
  logs.push(...(await deleteRedirects(api, 119, 1, ['הפניה ממרחב שיחת טיוטה למרחב השיחה'], 30)));
  logs.push(...(await deleteRedirects(api, 118, 0, ['הפניה ממרחב הטיוטה למרחב הערכים'], 30)));
  logs.push(...(await deleteRedirects(api, 3, 1, ['הפניה ממרחב שיחת משתמש למרחב שיחה'], 30)));
  logs.push(...(await deleteRedirects(api, 0, 2, ['הפניה ממרחב ראשי למרחב משתמש'])));
  logs.push(...(await deleteRedirects(api, 0, 118, ['הפניה ממרחב ראשי למרחב טיוטה'])));
  await writeAdminBotLogs(api, logs, 'משתמש:Sapper-bot/מחיקת הפניות חוצות מרחבי שם');
  await writeAdminBotLogs(api, convertLogs, 'משתמש:Sapper-bot/מחיקת דפי פלט של בוט ההסבה');
}

export const main = shabathProtectorDecorator(deleteBot);
