import fs from 'fs/promises';
import NewWikiApi from '../wiki/NewWikiApi';

export default async function updateIsraeliAuthors() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.recursiveSubCategories('סגל כלי תקשורת בישראל');
  const pages = new Set<string>();
  for await (const category of generator) {
    const categoryGenerator = api.categroyTitles(category.title.replace('קטגוריה:', ''), 500);
    for await (const categoryPages of categoryGenerator) {
      for (const page of categoryPages) {
        if (page.sortkeyprefix !== '*') {
          pages.add(page.title.replace(/ \(עיתונאית?\)/, '').replace(/ \(מאיירת?\)/, '').replace(/ \(ציירת?\)/, ''));
        }
      }
    }
  }

  await fs.writeFile('bot/data/israeli-authors.json', JSON.stringify(Array.from(pages), null, 2));
}
