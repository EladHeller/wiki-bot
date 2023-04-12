import 'dotenv/config';
import {
  login, updateArticle, search,
} from '../wikiAPI';

const link = '%d7%';

async function main() {
  await login();

  const res = search(link);
  let curr;
  do {
    curr = await res.next();
    curr.value?.forEach(async (page) => {
      const content = page.revisions?.[0].slots.main['*'];
      if (content && page.title) {
        const matches = content.match(/(?:%d7%[9aA][0-9a-fA-F]){3,}/gi);
        let newContent = content;
        if (!matches) {
          return;
        }
        matches.forEach((match) => {
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
  } while (!curr.done);
}

main().catch(console.error);
