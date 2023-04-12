import 'dotenv/config';
import { getRedirects, login, updateArticle } from '../wikiAPI';
import { WikiPage } from '../types';

async function deleteRedirects(from: number, to: number, title: string) {
  const generator = getRedirects(from, to);
  const all: WikiPage[] = [];
  let res;
  try {
    do {
      res = await generator.next();
      const batch: WikiPage[] = res.value;
      const relevent = batch.filter((x) => x.links != null);
      all.push(...relevent);
    // await promiseSequence(10, relevent.map((p: WikiPage) => async () => {
      // await deletePage(p.title);
    // }));
    } while (!res.done);
  } catch (error) {
    console.log(error?.data || error?.message || error?.toString());
  }
  await updateArticle(title, 'רשימה', `* ${all.map((x) => `[[${x.title}]]`).join('\n* ')}`);
}

async function main() {
  await login();
  await deleteRedirects(0, 118, 'user:Sapper-bot/הפניות ראשי לטיוטה');
  await deleteRedirects(119, 1, 'user:Sapper-bot/הפניות שיחה טיוטה לשיחה ');
  await deleteRedirects(118, 0, 'user:Sapper-bot/הפניות טיוטה לראשי');
}

main().catch(console.error);
