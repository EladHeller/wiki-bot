import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';

export default async function checkHedyataPages() {
  const api = WikiApi();
  await api.login();

  const rootCategory = 'תבניות הידעת?';
  const categoriesToProcess = [rootCategory];
  for await (const subCat of api.recursiveSubCategories(rootCategory)) {
    categoriesToProcess.push(subCat.title.replace(/^(Category|קטגוריה):/i, ''));
  }

  const list: string[] = [];
  const checkedPages = new Set<string>();

  for (const category of categoriesToProcess) {
    const generator = api.categroyPages(category);

    await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
      if (checkedPages.has(page.title)) {
        return;
      }
      checkedPages.add(page.title);

      const content = page.revisions?.[0]?.slots.main['*'];
      if (!content) {
        console.log(`${page.title}: content not found`);
        return;
      }

      const noincludeEndIndex = content.indexOf('</noinclude>');
      if (noincludeEndIndex === -1) {
        console.log(`${page.title}: </noinclude> not found`);
        return;
      }

      const contentAfterNoinclude = content.substring(noincludeEndIndex + '</noinclude>'.length);
      const activeContent = contentAfterNoinclude.replace(/<!--[\s\S]*?-->/g, '').trim();

      if (!activeContent) {
        list.push(`* [[${page.title}]]`);
      }
    });
  }

  await api.create('משתמש:Sapper-bot/תבניות הידעת? ריקות', 'בוט', list.join('\n'));
}
