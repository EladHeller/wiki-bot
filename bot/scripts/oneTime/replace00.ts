import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';

const link = 'no666.wordpress.com';
const link2 = 'www.no-666.com';

async function main() {
  const api = WikiApi();
  await api.login();

  const generator = api.externalUrl(link);
  await asyncGeneratorMapWithSequence(10, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (content && revid && page.title) {
      const newContent = content.replace(/no666\.wordpress\.com/g, link2);
      try {
        await api.edit(page.title, 'תיקון קישור לאתר "המולטי-יקום"', newContent, revid);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  });
}

main().catch(console.error);
