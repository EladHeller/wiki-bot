/* eslint-disable max-len */
import WikiApi from '../../wiki/WikiApi';
import { asyncGeneratorMapWithSequence } from '../../utilities';

const oldLink = 'righteous.yadvashem.org/?searchType=righteous_only&language=en';
async function main() {
  const api = WikiApi();
  await api.login();
  const generartor = api.externalUrl(oldLink);
  await asyncGeneratorMapWithSequence(10, generartor, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (content && page.title && revid) {
      let newContent = content;
      const refMatches = content.matchAll(
        /{{הערה\|\s*\[https:\/\/righteous\.yadvashem\.org\/\?searchType=righteous_only&language=en(?:&ind=0)?&itemId=(\d+)(?:[^ ]*) ([^\]]*)\][^}]+}}/g,
      );
      for (const match of refMatches) {
        const text = match[2] ? `${decodeURIComponent(match[2])}` : match[3]?.trim();
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        newContent = newContent.replace(match[0], `{{הערה|{{מזהה חסיד אומות העולם|${match[1]}|${text}}}}}`);
      }
      const externalUrlMatches = content.matchAll(
        /\*.*\[https:\/\/righteous\.yadvashem\.org\/\?searchType=righteous_only&language=en(?:&ind=0)?&itemId=(\d+)(?:[^ ]*) ([^\]]*)\].*/g,
      );
      for (const match of externalUrlMatches) {
        const text = match[2] ? `${decodeURIComponent(match[2])}` : match[3]?.trim();
        if (!text) {
          console.log('no text', page.title);
          return;
        }
        newContent = newContent.replace(match[0], `* {{מזהה חסיד אומות העולם|${match[1]}|${text}}}`);
      }
      const generalLink = content.matchAll(
        /{{קישור כללי\|כתובת=https:\/\/righteous\.yadvashem\.org\/\?searchType=righteous_only&language=en(?:&ind=0)?&itemId=(\d+)(?:[^|]*)\|[^}][^}]*כותרת=([^|]+)\|[^}]+}}/g,
      );
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
        await api.edit(page.title, 'הסבה ל[[תבנית:מזהה חסיד אומות העולם]]', newContent, revid);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  });
}

main();
