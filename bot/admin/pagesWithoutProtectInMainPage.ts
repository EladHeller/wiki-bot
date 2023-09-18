import BaseWikiApi, { defaultConfig } from '../wiki/BaseWikiApi';
import { ArticleLog } from './types';

const articles = [
  'ויקיפדיה:עמוד ראשי/מחר',
  'ויקיפדיה:עמוד ראשי/מחרתיים',
];

type Page = {
    title: string;
    protection?: [
        {
            type: 'edit' | 'move';
            expiry: 'infinity' | string;
            level: 'templateeditor' | 'sysop' | 'editautopatrolprotected' | 'autoconfirmed';
        }
    ]
}

function problemsInLevel(
  page: Page,
  name: string,
  viewName: string,
  article: string,
): ArticleLog[] {
  const problems: ArticleLog[] = [];
  const protection = page.protection?.find(({ type }) => type === name);

  if (!protection) {
    problems.push({
      title: page.title,
      needProtection: true,
      text: `[[${article}]]: [[${page.title}]] - דף ללא הגנת ${viewName}`,
    });
    return problems;
  }

  if (protection.level === 'autoconfirmed') {
    problems.push({
      title: page.title,
      text: `[[${article}]]: [[${page.title}]] - דף עם הגנת ${viewName} רק למשתמשים מאומתים`,
      needProtection: true,
    });
  }

  if (protection.expiry !== 'infinity') {
    problems.push({
      title: page.title,
      text: `[[${article}]]: [[${page.title}]] - דף עם הגנת ${viewName} לזמן מוגבל`,
      needProtection: true,
    });
  }
  return problems;
}

export default async function pagesWithoutProtectInMainPage(): Promise<ArticleLog[]> {
  const api = BaseWikiApi(defaultConfig);
  await api.login();

  const problems: ArticleLog[] = [];
  await Promise.all(articles.map(async (article) => {
    const response = await api.request(`?action=query&format=json&generator=templates&titles=${encodeURIComponent(article)}&prop=info&gtllimit=5000&inprop=protection`);
    const pages: Page[] = Object.values(response?.query?.pages ?? {});
    pages.forEach((page) => {
      if (!page.protection?.length) {
        problems.push({
          title: page.title,
          text: `[[${article}]]: [[${page.title}]] - דף ללא הגנה`,
          needProtection: true,
        });
        return;
      }
      problems.push(...problemsInLevel(page, 'edit', 'עריכה', article));
      problems.push(...problemsInLevel(page, 'move', 'העברה', article));
    });
  }));

  await Promise.all(articles.flatMap(async (article) => {
    const response = await api.request(`?action=query&format=json&generator=images&titles=${encodeURIComponent(article)}&prop=info&gimlimit=500&inprop=protection`);
    const pages: Page[] = Object.values(response?.query?.pages ?? {});
    pages.forEach((page) => {
      if ('missing' in page) {
        problems.push(...problemsInLevel(page, 'create', 'יצירה', article));
        return;
      }
      if (!page.protection?.length) {
        problems.push({
          title: page.title,
          text: `[[${article}]]: [[${page.title}]] - דף ללא הגנה`,
          needProtection: true,
        });
        return;
      }
      problems.push(...problemsInLevel(page, 'edit', 'עריכה', article));
      problems.push(...problemsInLevel(page, 'move', 'העברה', article));
    });
  }));
  return problems;
}
