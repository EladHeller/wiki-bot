import 'dotenv/config';
import express from 'express';
import {
  login, updateArticle, search,
} from '../wikiAPI';

const link = '%d7%';

async function main() {
  await login();

  const res = search(link, 5, 5);
  let curr = await res.next();

  while (curr.done === false) {
    curr.value?.forEach(async (page) => {
      const content = page.revisions?.[0].slots.main['*'];
      if (content && page.title) {
        const matches = content.match(/(?:%d7%[9aA][0-9a-fA-F]){2,}/gi);
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
          console.log(page.title, 'קידוד קישור', newContent);
        } catch (error) {
          console.log(error?.data || error?.message || error?.toString());
        }
        console.log(page.title);
      }
    });
    curr = await res.next();
  }
}

const app = express();

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(3000, () => console.log('Server running on port 3000'));

main().catch(console.error);
