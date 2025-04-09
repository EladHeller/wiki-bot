import fs from 'fs/promises';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const ROOT_CATEGORY = 'קטגוריה:ויקיפדיה - מדיניות פנים';

const ignorePagesPrefix = [
  'ויקיפדיה:מיזמי ויקיפדיה/',
  'ויקיפדיה:רשימת מועמדים למחיקה',
  'ויקיפדיה:הצבעת אמון במפעיל מערכת/',
  'ויקיפדיה:רשימת ערכים במחלוקת/',
  'ויקיפדיה:רשימת מועמדים לשחזור/',
  'ויקיפדיה:עבודות ויקידמיות/',
];

const mustHavePrefixes = [
  'עזרה:',
  'ויקיפדיה:',
];

const handledPages: string[] = [];
let text = '';

async function categoryHandler(api: IWikiApi, category: string) {
  const categoryGenerator = api.categroyTitles(category.replace('קטגוריה:', ''), 500);
  console.log(`Handle category: ${category}`);
  await asyncGeneratorMapWithSequence(1, categoryGenerator, (page) => async () => {
    if (handledPages.includes(page.title)) {
      return;
    }
    handledPages.push(page.title);
    if (page.title.startsWith('קטגוריה:')) {
      await categoryHandler(api, page.title);
      return;
    }
    if (!mustHavePrefixes.some((prefix) => page.title.startsWith(prefix))) {
      console.log(`Page is not help page: ${page.title}`);
      return;
    }
    if (ignorePagesPrefix.some((prefix) => page.title.startsWith(prefix))) {
      console.log(`Page start with ignore prefix: ${page.title}`);
      return;
    }
    const { content } = await api.articleContent(page.title);
    if (!content) {
      throw new Error(`Page ${page.title} missing content`);
    }
    console.log(`Write page to file: ${page.title}`);
    text += `### ${page.title}\n\n${content}\n\n`;
  });
}

export default async function getAllHelpPages() {
  const api = WikiApi();
  await api.login();
  await categoryHandler(api, ROOT_CATEGORY);
  await fs.writeFile('wikipedia-policies.txt', text, 'utf-8');
}
