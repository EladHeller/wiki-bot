import fs from 'fs/promises';
import BaseWikiApi, { defaultConfig } from '../../wiki/BaseWikiApi';
import WikiApi from '../../wiki/WikiApi';
/**
 *  <nowiki>===צירופים===</nowiki>
 <nowiki>* [[צירוף מילים]]</nowiki>
וכן:
 <nowiki>===גיזרון===</nowiki>
 <nowiki>* כאן יש לכתוב את מקור המילה (או הצרף).</nowiki>
וכן:
 <nowiki>===צירופים===</nowiki>
 <nowiki>* [[צירוף מילים]]</nowiki>
וכן:
 <nowiki>===נגזרות===</nowiki>
 <nowiki>* [[מילה גזורה]]</nowiki>
וכן:
 <nowiki>===מילים נרדפות===</nowiki>
 <nowiki>* [[מילה נרדפת]]</nowiki>
וכן:
 <nowiki>===ניגודים===</nowiki>
 <nowiki>* [[ניגוד]]</nowiki>
וכן (זה המופע הנפוץ ביותר):
 <nowiki>===תרגום===</nowiki>
 <nowiki>* אנגלית: {{ת|אנגלית|word}}</nowiki>
וכן:
 <nowiki>===ראו גם===</nowiki>
 <nowiki>* הוסיפו לכאן קישורים למונחים קרובים בוויקימילון.</nowiki>
וכן:
 <nowiki>===קישורים חיצוניים===</nowiki>
 <nowiki>{{מיזמים|ויקיפדיה=ערך בוויקיפדיה|ויקישיתוף=ערך בוויקישיתוף}}</nowiki>
 <nowiki>* שם כותב, [Address תיאור המאמר], שם האתר</nowiki>
ואחרון:
 <nowiki>[[קטגוריה:שם הקטגוריה]]</nowiki>
 */
const textsToRemove = [
  `===צירופים===
* [[צירוף מילים]]`,
  `===גיזרון===
* כאן יש לכתוב את מקור המילה (או הצרף).`,
  `===צירופים===
* [[צירוף מילים]]`,
  `===נגזרות===
* [[מילה גזורה]]`,
  `===מילים נרדפות===
* [[מילה נרדפת]]`,
  `===ניגודים===
* [[ניגוד]]`,
  `===תרגום===
* אנגלית: {{ת|אנגלית|word}}`,
  `===ראו גם===
* הוסיפו לכאן קישורים למונחים קרובים בוויקימילון.`,
  `===קישורים חיצוניים===
{{מיזמים|ויקיפדיה=ערך בוויקיפדיה|ויקישיתוף=ערך בוויקישיתוף}}
* שם כותב, [Address תיאור המאמר], שם האתר`,
  '[[קטגוריה:שם הקטגוריה]]',
];
const pagesForCleanup: string[] = [];

export default async function wikitionaryArticleTemplateCleanup() {
  const baseApi = BaseWikiApi({
    ...defaultConfig,
    assertBot: false,
    baseUrl: 'https://he.wiktionary.org/w/api.php',
  });
  const api = WikiApi(baseApi);
  await api.login();
  const generator = api.allPages(0, 'חשמן');
  try {
    for await (const pages of generator) {
      for (const page of pages) {
        const content = page.revisions?.[0].slots.main['*'];
        const { revid } = page.revisions?.[0] ?? { revid: 0 };
        if (!content || !revid) {
          throw new Error('Failed to get content or revid');
        }
        let newContent = content;
        console.log('Checking', page.title);
        textsToRemove.forEach((text) => {
          newContent = newContent.replace(text, '');
        });
        if (content !== newContent) {
          pagesForCleanup.push(page.title);
        // await api.edit(page.title, 'הסרת מחרוזות שמקורן ב[[תבנית:תבנית הערך]]', newContent, revid);
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await fs.writeFile('wikitionaryArticleTemplateCleanup1.json', JSON.stringify(pagesForCleanup, null, 2));
    console.log('pagesForCleanup', pagesForCleanup.length);
  }
}
