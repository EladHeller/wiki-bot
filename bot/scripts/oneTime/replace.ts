import WikiApi from '../../wiki/WikiApi';
import { asyncGeneratorMapWithSequence } from '../../utilities';

const link = '%d7%';

async function main() {
  const api = WikiApi();
  await api.login();
  const generartor = api.search(link);

  await asyncGeneratorMapWithSequence(10, generartor, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (content && page.title && revid) {
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
        await api.edit(page.title, 'קידוד קישור', newContent, revid);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  });
}

main().catch(console.error);
