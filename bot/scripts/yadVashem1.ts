import 'dotenv/config';
import { login, externalUrl, updateArticle } from '../wikiAPI';
import { promiseSequence } from '../utilities';

const oldLink = 'db.yadvashem.org/righteous/';
const regex = /http:\/\/db\.yadvashem\.org\/righteous\/(?:righteousName|family|facebookFamily)\.html\?language=en&itemId=(\d+)/g;
const newLink = 'https://righteous.yadvashem.org/?searchType=righteous_only&language=en&ind=0&itemId=';
async function main() {
  await login();
  const res = await externalUrl(oldLink, 'http');
  console.log(res.length);
  await promiseSequence(1, res.map((page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (content && page.title) {
      const newContent = content.replace(regex, `${newLink}$1`);
      if (newContent === content) {
        console.log('no change', page.title);
        return;
      }
      try {
        await updateArticle(page.title, 'עדכון קישורים לאתר יד ושם', newContent);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  }));
}

main();
