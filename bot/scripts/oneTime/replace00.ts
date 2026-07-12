import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';

const link = 'library.osu.edu/projects/hebrew-lexicon';
const link2 = 'benyehuda.org/lexicon';

export default async function replaceLink() {
  const api = WikiApi();
  await api.login();

  const generator = api.externalUrl(link);
  await asyncGeneratorMapWithSequence(10, generator, (page) => async () => {
    if (page.title === 'ויקיפדיה:בוט/בקשות') {
      return;
    }
    const { content, revid } = contentFromPage(page);
    if (content && revid && page.title) {
      const newContent = content.replace(/library\.osu\.edu\/projects\/hebrew-lexicon/g, link2);
      try {
        await api.edit(page.title, 'תיקון קישורים ללקסיקון הספרות העברית החדשה', newContent, revid);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  });
}
