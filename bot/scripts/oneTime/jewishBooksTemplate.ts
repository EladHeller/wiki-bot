import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';

const TEMPLATE_NAME = 'אוצר הספרים היהודי';

export default async function jewishBooks() {
  const api = WikiApi();
  const generator = api.getArticlesWithTemplate(`תבנית:${TEMPLATE_NAME}`);

  await asyncGeneratorMapWithSequence(10, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!content || !revid) {
      console.log('no content or revid', page.title);
      return;
    }
    if (page.ns !== 0) {
      console.log('not main ns', page.title);
      return;
    }
    const newContent = content.replace(/\n{{אוצר הספרים היהודי/g, `\n* {{${TEMPLATE_NAME}`);
    if (newContent !== content) {
      await api.edit(page.title, 'עיצוב תבנית', newContent, revid);
      console.log(page.ns, page.title);
    } else {
      console.log('no change', page.title);
    }
  });
}
