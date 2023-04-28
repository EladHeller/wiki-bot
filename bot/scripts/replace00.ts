import 'dotenv/config';
import { promiseSequence } from '../utilities';
import { login, externalUrl, updateArticle } from '../wiki/wikiAPI';

const link = 'no666.wordpress.com';
const link2 = 'www.no-666.com';

async function main() {
  await login();

  const res = await externalUrl(link);
  console.log(res.length);
  await promiseSequence(10, res.map((page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (content && page.title) {
      const newContent = content.replace(/no666\.wordpress\.com/g, link2);
      try {
        await updateArticle(page.title, 'תיקון קישור לאתר "המולטי-יקום"', newContent);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  }));
}

main().catch(console.error);
