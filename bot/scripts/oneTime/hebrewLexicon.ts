import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';

const link = 'library.osu.edu/projects/hebrew-lexicon';
const link2 = 'benyehuda.org/lexicon';

export default async function hebrewLexicon(api: IWikiApi) {
  const generator = api.externalUrl(link, 'https', '*');
  await asyncGeneratorMapWithSequence(50, generator, (page) => async () => {
    if (page.title === 'ויקיפדיה:בוט/בקשות') {
      return;
    }
    const { content, revid } = contentFromPage(page);
    if (content && revid && page.title) {
      const newContent = content.replace(/library\.osu\.edu\/projects\/hebrew-lexicon/g, link2);

      if (newContent === content) {
        console.log(page.title, 'not changed');
      } else {
        console.log(page.title);

        try {
          await api.edit(page.title, 'תיקון קישורים ללקסיקון הספרות העברית החדשה', newContent, revid);
        } catch (error) {
          console.log(error?.data || error?.message || error?.toString());
        }
      }
    }
  });
}
