import 'dotenv/config';
import {
  login, updateArticle, search,
} from '../wikiAPI';

const link = '%d7%';

async function main() {
  await login();

  const res = search(link);
  let curr = await res.next();

  while (curr.done === false) {
    console.log(curr.value);
    curr.value?.forEach(async (page) => {
      const content = page.revisions?.[0].slots.main['*'];
      if (content && page.title) {
        const matches = content.match(/(%d7%[a-zA-Z0-9%]+)(?:%20)?/gi);
        let newContent = content;
        if (!matches) {
          return;
        }
        matches.forEach((match) => {
          const decoded = decodeURIComponent(match);
          if (decoded.match('[^א-ת]')) {
            return;
          }
          newContent = newContent.replace(match, decodeURIComponent(match));
        });
        if (newContent === content) {
          return;
        }
        try {
          await updateArticle(page.title, 'קידוד קישור', newContent);
        } catch (error) {
          console.log(error?.data || error?.message || error?.toString());
        }
        console.log(page.title);
      }
    });
    curr = await res.next();
  }
}

main().catch(console.error);
