import 'dotenv/config';
import {
  login, updateArticle, externalUrl,
} from '../../wiki/wikiAPI';
import { promiseSequence } from '../../utilities';

const oldLink = 'righteous.yadvashem.org/?searchType=righteous_only&language=en';
async function main() {
  await login();
  const pages = await externalUrl(oldLink);
  await promiseSequence(1, pages.map((page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (content && page.title) {
      let newContent = content;
      const refMatches = content.matchAll(/{{הערה\|\s*\[https:\/\/righteous\.yadvashem\.org\/\?searchType=righteous_only&language=en(?:&ind=0)?&itemId=(\d+)(?:[^ ]*) ([^\]]*)\][^}]+}}/g);
      for (const match of refMatches) {
        const text = match[2] ? `${decodeURIComponent(match[2])}` : match[3]?.trim();
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        newContent = newContent.replace(match[0], `{{הערה|{{מזהה חסיד אומות העולם|${match[1]}|${text}}}}}`);
      }
      const externalUrlMatches = content.matchAll(/\*.*\[https:\/\/righteous\.yadvashem\.org\/\?searchType=righteous_only&language=en(?:&ind=0)?&itemId=(\d+)(?:[^ ]*) ([^\]]*)\].*/g);
      for (const match of externalUrlMatches) {
        const text = match[2] ? `${decodeURIComponent(match[2])}` : match[3]?.trim();
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        newContent = newContent.replace(match[0], `* {{מזהה חסיד אומות העולם|${match[1]}|${text}}}`);
      }
      const generalLink = content.matchAll(/{{קישור כללי\|כתובת=https:\/\/righteous\.yadvashem\.org\/\?searchType=righteous_only&language=en(?:&ind=0)?&itemId=(\d+)(?:[^|]*)\|[^}][^}]*כותרת=([^|]+)\|[^}]+}}/g);
      for (const match of generalLink) {
        let text = decodeURIComponent(match[2]);
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        if (text.match(/יד ושם|Yad Vashem/i)) {
          text = '{{שם הדף}}';
        }
        newContent = newContent.replace(match[0], `{{מזהה חסיד אומות העולם|${match[1]}|${text}}}`);
      }
      if (newContent === content) {
        console.log('no change', page.title);
        return;
      }
      try {
        await updateArticle(page.title, 'הסבה ל[[תבנית:מזהה חסיד אומות העולם]]', newContent);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  }));
}

main();
