import fs from 'fs/promises';
import { asyncGeneratorMapWithSequence } from '../utilities';
import { getArticlesWithTemplate, updateArticle } from '../wiki/wikiAPI';

const TEMPLATE_NAME = 'אוצר הספרים היהודי';

export default async function jewishBooks() {
  const generator = getArticlesWithTemplate(`תבנית:${TEMPLATE_NAME}`);
  let res = '';

  await asyncGeneratorMapWithSequence(10, generator, (page) => async () => {
    const content = page.revisions[0].slots.main['*'];
    if (!content) {
      console.log('no content', page.title);
      return;
    }
    if (page.ns !== 0) {
      console.log('not main ns', page.title);
      return;
    }
    const newContent = content.replace(/\n{{אוצר הספרים היהודי/g, `\n* {{${TEMPLATE_NAME}`);
    if (newContent !== content) {
      res += `${page.title}\n${newContent}\n\n`;
      await updateArticle(page.title, 'עיצוב תבנית', newContent);
      console.log(page.ns, page.title);
    } else {
      console.log('no change', page.title);
    }
  });
  await fs.writeFile('jewishBooks.txt', res);
}
