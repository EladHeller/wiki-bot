/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import {
  deletePage, getRedirects, listCategory, login,
} from '../wikiAPI';
import { WikiPage } from '../types';
import { promiseSequence } from '../utilities';

async function deleteRedirects(from: number, to: number[], title: string, reason: string) {
  const generator = getRedirects(from, to);
  const all: WikiPage[] = [];
  let res;
  try {
    do {
      res = await generator.next();
      const batch: WikiPage[] = Object.values(res.value?.query?.pages ?? {});
      const relevent = batch.filter((x) => x.links?.length === 1);
      all.push(...relevent);
      await promiseSequence(10, relevent.map((p: WikiPage) => async () => {
        await deletePage(p.title, reason);
      }));
    } while (!res.done);
  } catch (error) {
    console.log(error?.data || error?.message || error?.toString());
  }
  const unique = all.filter((v, i, a) => a.findIndex((t) => t.title === v.title) === i);
  console.log(unique.map((x) => `[[${x.title}]] ${x.links?.length === 1 ? ` {{כ}}← [[${x.links?.[0].title}]]` : 'לא ברור'}`).join('\n'));
}

async function deleteInCategory(category: string) {
  const generator = listCategory(category);
  let res;
  try {
    do {
      res = await generator.next();
      const batch = res.value?.query?.categorymembers;
      if (batch) {
        await promiseSequence(10, batch.map(
          (p: WikiPage) => async () => {
            console.log('going to delete: ', p.title);
            await deletePage(p.title, 'דף פלט למחיקה של בוט ההסבה');
          },
        ));
      }
    } while (!res.done);
  } catch (error) {
    console.log(error?.data || error?.message || error?.toString());
  }
}

export async function main() {
  await login();
  console.log('logged in');
  // await deleteInCategory('ויקיפדיה/בוט/בוט ההסבה/דפי פלט/למחיקה');
  await deleteRedirects(119, [1], 'user:Sapper-bot/הפניות שיחה טיוטה לשיחה', 'הפניה ממרחב שיחת טיוטה למרחב השיחה');
  await deleteRedirects(118, [0], 'user:Sapper-bot/הפניות טיוטה לראשי', 'הפניה ממרחב הטיוטה למרחב הערכים');
  await deleteRedirects(3, [1], 'user:Sapper-bot/הפניות שיחת משתמש לשיחה', 'הפניה ממרחב שיחת משתמש למרחב שיחה');
  await deleteRedirects(0, [2, 118], 'user:Sapper-bot/הפניות ראשי למשתמש או טיוטה', 'הפניה ממרחב ראשי למרחב טיוטה');
}
