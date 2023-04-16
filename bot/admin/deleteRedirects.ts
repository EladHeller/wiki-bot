import 'dotenv/config';
import {
  deletePage, getRedirects, login, updateArticle,
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
      const relevent = batch.filter((x) => x.links != null);
      all.push(...relevent);
      await promiseSequence(10, relevent.map((p: WikiPage) => async () => {
        await deletePage(p.title, reason);
      }));
    } while (!res.done);
  } catch (error) {
    console.log(error?.data || error?.message || error?.toString());
  }
  const unique = all.filter((v, i, a) => a.findIndex((t) => t.title === v.title) === i);
  await updateArticle(title, 'רשימה', `* ${unique.map((x) => `[[${x.title}]] ${x.links?.length === 1 ? ` {{כ}}← [[${x.links?.[0].title}]]` : 'לא ברור'}`).join('\n* ')}`);
}

async function main() {
  await login();
  await deleteRedirects(119, [1], 'user:Sapper-bot/הפניות שיחה טיוטה לשיחה', 'הפניה ממרחב שיחת טיוטה למרחב השיחה');
  await deleteRedirects(118, [0], 'user:Sapper-bot/הפניות טיוטה לראשי', 'הפניה ממרחב הטיוטה למרחב הערכים');
  await deleteRedirects(3, [1], 'user:Sapper-bot/הפניות שיחת משתמש לשיחה', 'הפניה ממרחב שיחת משתמש למרחב שיחה');
  await deleteRedirects(0, [2, 118], 'user:Sapper-bot/הפניות ראשי למשתמש או טיוטה', 'הפניה ממרחב ראשי למרחב טיוטה');
}

main().catch(console.error);
