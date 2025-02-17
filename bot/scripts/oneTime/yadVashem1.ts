import 'dotenv/config';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';

const oldLink = 'db.yadvashem.org/righteous/';
// eslint-disable-next-line max-len
const regex = /http:\/\/db\.yadvashem\.org\/righteous\/(?:righteousName|family|facebookFamily)\.html\?language=en&itemId=(\d+)/g;
const newLink = 'https://righteous.yadvashem.org/?searchType=righteous_only&language=en&ind=0&itemId=';
async function main() {
  const api = WikiApi();
  await api.login();
  const generartor = api.externalUrl(oldLink, 'http');
  await asyncGeneratorMapWithSequence(10, generartor, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (content && page.title && revid) {
      const newContent = content.replace(regex, `${newLink}$1`);
      if (newContent === content) {
        console.log('no change', page.title);
        return;
      }
      try {
        await api.edit(page.title, 'עדכון קישורים לאתר יד ושם', newContent, revid);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  });
}

main();
