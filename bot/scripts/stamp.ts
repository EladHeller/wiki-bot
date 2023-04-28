import 'dotenv/config';
import { promiseSequence } from '../utilities';
import { login, externalUrl, updateArticle } from '../wiki/wikiAPI';

const link = 'israelphilately.org.il/he/catalog/articles';

async function main() {
  await login();

  const res = await externalUrl(link, 'http');
  console.log(res.length);
  await promiseSequence(10, res.map((page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (content && page.title) {
      let newContent = content;
      const refMatches = content.matchAll(/{{הערה\|\s*\[http:\/\/(?:www\.)?israelphilately\.org\.il\/he\/catalog\/articles\/(\d+)\/?([^ \]]*)([^\]]+)[^}]+}}/g);
      for (const match of refMatches) {
        const text = match[2] ? `${decodeURIComponent(match[2])}` : match[3]?.trim();
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        newContent = newContent.replace(match[0], `{{הערה|{{בול ישראלי - עלון||${match[1]}|${text}}}}}`);
      }
      const externalUrlMatches = content.matchAll(/\*.*\[http:\/\/(?:www\.)?israelphilately\.org\.il\/he\/catalog\/articles\/(\d+)\/?([^ \]]*)([^\]]+).*/g);
      for (const match of externalUrlMatches) {
        const text = match[2] ? `${decodeURIComponent(match[2])}` : match[3]?.trim();
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        newContent = newContent.replace(match[0], `{{הערה|{{בול ישראלי - עלון||${match[1]}|${text}}}}}`);
      }
      if (newContent === content) {
        console.log('no change', page.title);
        return;
      }
      try {
        await updateArticle(page.title, 'הסבה ל[[תבנית:בול ישראלי - עלון]]', newContent);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  }));
}

main().catch(console.error);
