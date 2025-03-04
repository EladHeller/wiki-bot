/* eslint-disable max-len */
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

/**
  * ===תרגום===
{{תרגומים|
* אנגלית: {{ת|אנגלית|word}}
* גרמנית: {{ת|גרמנית|Wort}}
* ספרדית: {{ת|ספרדית|palabra}}
|
* ערבית: {{ת|ערבית|كلمة}}
* רוסית: {{ת|רוסית|слово}}
}}
  */
const regexesToRemove = [
  /===\s*צירופים\s*===\s*\*\s*\[\[צירוף\s*מילים\]\]\n?/g,
  /===\s*גיזרון\s*===\s*\*\s*כאן\s*יש\s*לכתוב\s*את\s*מקור\s*המילה\s*\(?או\s*הצרף\)\?.\n?/g,
  /===\s*נגזרות\s*===\s*\*\s*\[\[מילה\s*גזורה\]\]\n?/g,
  /===\s*מילים\s*נרדפות\s*===\s*\*\s*\[\[מילה\s*נרדפת\]\]\n?/g,
  /===\s*ניגודים\s*===\s*\*\s*\[\[ניגוד\]\]\n?/g,
  /===\s*תרגום\s*===(?:<!--כאשר ביטוי לא קיים בשפות אחרות \(בצורתו המילולית\) אין לתרגמו-->)?\s*\*\s*אנגלית:\s*{{ת\|אנגלית\|word}}\n?/g,
  /===\s*ראו\s*גם\s*===\s*\*\s*הוסיפו\s*לכאן\s*קישורים\s*למונחים\s*קרובים\s*בוויקימילון\.\n?/g,
  /===\s*קישורים\s*חיצוניים\s*===\s*{{מיזמים\|ויקיפדיה=ערך\s*בוויקיפדיה\|ויקישיתוף=ערך\s*בוויקישיתוף}}(?:\s*\*\s*שם\s*כותב,\s*\[Address\s*תיאור\s*המאמר\],\s*שם\s*האתר)?\n?[^*]/g,
  /\[\[קטגוריה:שם\s*הקטגוריה\]\]\n?/g,
  /===\s*תרגום\s*===\s*{{תרגומים\|\n\*\s*אנגלית:\s*{{ת\|אנגלית\|word}}\n\*\s*גרמנית:\s*{{ת\|גרמנית\|Wort}}\n\*\s*ספרדית:\s*{{ת\|ספרדית\|palabra}}\n\|\n\*\s*ערבית:\s*{{ת\|ערבית\|كلمة}}\n\*\s*רוסית:\s*{{ת\|רוסית\|слово}}\n}}\n?/g,
];

const looseRegexes = [
  /\*\s*\[\[צירוף\s*מילים\]\]/g,
  /כאן\s*יש\s*לכתוב\s*את\s*מקור\s*המילה\s*\(?או\s*הצרף\)\?.\n?/g,
  /\*\s*\[\[מילה\s*גזורה\]\]/g,
  /\*\s*\[\[מילה\s*נרדפת\]\]/g,
  /\*\s*\[\[ניגוד\]\]/g,
  /\*\s*אנגלית:\s*{{ת\|אנגלית\|word}}/g,
  /הוסיפו\s*לכאן\s*קישורים\s*למונחים\s*קרובים\s*בוויקימילון\./g,
  /{{מיזמים\|ויקיפדיה=ערך\s*בוויקיפדיה\|ויקישיתוף=ערך\s*בוויקישיתוף}}/g,
  /\[\[קטגוריה:שם\s*הקטגוריה\]\]/g,
];
const pagesForCleanup: string[] = [];
const pagesWithLoose: string[] = [];

export default async function wikitionaryArticleTemplateCleanup() {
  const baseApi = BaseWikiApi({
    ...defaultConfig,
    baseUrl: 'https://he.wiktionary.org/w/api.php',
  });
  const api = WikiApi(baseApi);
  await api.login();
  const generator = api.allPages(0, 'גוב');
  try {
    for await (const pages of generator) {
      for (const page of pages) {
        const content = page.revisions?.[0].slots.main['*'];
        const { revid } = page.revisions?.[0] ?? { revid: 0 };
        if (content == null || !revid) {
          throw new Error('Failed to get content or revid');
        }
        let newContent = content;
        console.log('Checking', page.title);
        regexesToRemove.forEach((regex) => {
          newContent = newContent.replace(regex, '');
        });
        if (content !== newContent) {
          pagesForCleanup.push(page.title);
        }

        if (looseRegexes.some((regex) => content.match(regex))) {
          pagesWithLoose.push(page.title);
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await fs.writeFile('wikitionaryArticleTemplateCleanup.json', JSON.stringify(pagesForCleanup, null, 2));
    await fs.writeFile('wikitionaryArticleTemplateCleanup_loose.json', JSON.stringify(pagesWithLoose, null, 2));
    console.log('pagesForCleanup', pagesForCleanup.length);
  }
}
const resultsDict = {};
export async function cleanupArticles() {
  const baseApi = BaseWikiApi({
    ...defaultConfig,
    baseUrl: 'https://he.wiktionary.org/w/api.php',
  });
  const api = WikiApi(baseApi);
  await api.login();
  const pages = JSON.parse(await fs.readFile('wikitionaryArticleTemplateCleanup_loose.json', 'utf-8'));
  for (const page of pages) {
    const { content, revid } = await api.articleContent(page);
    let newContent = content;
    looseRegexes.forEach((regex) => {
      if (!resultsDict[regex.toString()]) {
        resultsDict[regex.toString()] = 0;
      }
      if (content.match(regex)) {
        resultsDict[regex.toString()] += 1;
      }
      newContent = newContent.replaceAll(regex, '');
    });
    if (content.endsWith('{{מיזמים|ויקיפדיה=ערך בוויקיפדיה|ויקישיתוף=ערך בוויקישיתוף}}')) {
      newContent = newContent.replace(/===\s*קישורים\s*חיצוניים\s*===\s*{{מיזמים\|ויקיפדיה=ערך\s*בוויקיפדיה\|ויקישיתוף=ערך\s*בוויקישיתוף}}/g, '');
    }
    if (content !== newContent) {
      console.log(`About to edit ${page}. Continue? (y/n)`);
      const answer = await new Promise((resolve) => {
        process.stdin.once('data', (data) => {
          resolve(data.toString().trim().toLowerCase());
        });
      });
      if (answer !== 'y') {
        console.log('Skipping...');
      } else {
        await api.edit(page, 'הסרת מחרוזות שמקורן ב[[תבנית:תבנית הערך]]', newContent, revid);
      }
    }
  }
  console.log(JSON.stringify(resultsDict, null, 2));
}
