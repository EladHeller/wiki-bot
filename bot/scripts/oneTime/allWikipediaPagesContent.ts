import fs from 'fs/promises';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

async function handleCategory(api: IWikiApi, category: string) {
  const name = category.replace('קטגוריה:', '');
  const generator = api.categroyPages(name);
  await fs.statfs(`./wiki-policy-pages/${name}`).catch(() => fs.mkdir(`./wiki-policy-pages/${name}`));
  for await (const pages of generator) {
    for (const page of pages) {
      if (page.title.startsWith('ויקיפדיה:')) {
        const content = page.revisions?.[0]?.slots.main['*'];
        if (!content) {
          console.error('No content', page.title);
        } else {
          await fs.writeFile(`./wiki-policy-pages/${name}/${page.title.replaceAll('/', ' - ')}.txt`, content);
        }
      }
    }
  }
}

export default async function wikipediaPagesContent(category: string) {
  const api = WikiApi();
  await api.login();
  await handleCategory(api, category);
  const generator = api.recursiveSubCategories(category);
  for await (const categoryPage of generator) {
    await handleCategory(api, categoryPage.title);
  }
}
