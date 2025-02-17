import { WikiPage } from '../types';
import WikiApi from '../wiki/WikiApi';
import { ArticleLog } from './types';

const articles = [
  'ויקיפדיה:עמוד ראשי/מחר',
  'ויקיפדיה:עמוד ראשי/מחרתיים',
];

export default async function pagesWithCopyrightIssuesInMainPage(): Promise<ArticleLog[]> {
  const api = WikiApi();
  await api.login();
  const suspectedCopyrightInfringement: ArticleLog[] = [];

  const categories: string[] = ['קטגוריה:ויקיפדיה - תמונות שימוש הוגן', 'קטגוריה:תמונות החשודות בהפרת זכויות יוצרים'];
  const fairUseGenerator = api.recursiveSubCategories('ויקיפדיה - תמונות שימוש הוגן');
  for await (const category of fairUseGenerator) {
    categories.push(category.title);
  }

  const suspectedGenerator = api.recursiveSubCategories('תמונות החשודות בהפרת זכויות יוצרים');

  for await (const category of suspectedGenerator) {
    categories.push(category.title);
  }

  await Promise.all(articles.map(async (article) => {
    const response = await api.request(`?action=query&format=json&generator=images&titles=${encodeURIComponent(article)}&prop=categories&cllimit=500`);
    const pages: WikiPage[] = Object.values(response?.query?.pages ?? {});
    pages.forEach((page) => {
      if (!('missing' in page)) {
        page.categories?.forEach((category) => {
          if (categories.includes(category.title)) {
            suspectedCopyrightInfringement.push({
              title: page.title,
              text: `[[${article}]]: [[:${page.title}]] - [[:${category.title}]]`,
            });
          }
        });
      }
    });
  }));
  return suspectedCopyrightInfringement;
}
