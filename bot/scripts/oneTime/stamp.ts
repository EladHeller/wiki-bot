import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';

const link = 'israelphilately.org.il/he/catalog/articles';

async function main() {
  const api = WikiApi();
  await api.login();

  const generator = api.externalUrl(link, 'http');
  await asyncGeneratorMapWithSequence(10, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (content && page.title && revid) {
      let newContent = content;
      const refMatches = content.matchAll(
        // eslint-disable-next-line max-len
        /{{הערה\|\s*\[http:\/\/(?:www\.)?israelphilately\.org\.il\/he\/catalog\/articles\/(\d+)\/?([^ \]]*)([^\]]+)[^}]+}}/g,
      );
      for (const match of refMatches) {
        const text = match[2] ? `${decodeURIComponent(match[2])}` : match[3]?.trim();
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        newContent = newContent.replace(match[0], `{{הערה|{{בול ישראלי - עלון||${match[1]}|${text}}}}}`);
      }
      const externalUrlMatches = content.matchAll(
        /\*.*\[http:\/\/(?:www\.)?israelphilately\.org\.il\/he\/catalog\/articles\/(\d+)\/?([^ \]]*)([^\]]+).*/g,
      );
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
        await api.edit(page.title, 'הסבה ל[[תבנית:בול ישראלי - עלון]]', newContent, revid);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  });
}

main().catch(console.error);
