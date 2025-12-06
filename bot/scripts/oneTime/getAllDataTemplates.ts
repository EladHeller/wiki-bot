import fs from 'fs/promises';
import WikiApi from '../../wiki/WikiApi';

export default async function getAllDataTemplates() {
  const api = WikiApi();
  await api.login();
  const titles: string[] = [];
  const generator = api.recursiveSubCategories('תבניות מידע');
  for await (const page of generator) {
    if (!page.title.startsWith('קטגוריה:תבניות בוט היישובים')) {
      const titlesGenerator = api.categroyTitles(page.title.replace('קטגוריה:', ''));
      for await (const titlesPages of titlesGenerator) {
        titlesPages.forEach((title) => {
          if (!title.title.startsWith('קטגוריה:')) {
            titles.push(title.title);
          }
        });
      }
    }
  }
  await fs.writeFile('templates.json', JSON.stringify(titles, null, 2));
}
