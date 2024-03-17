import 'dotenv/config';
import {
  categoriesStartsWith, categroyPages, deletePage, updateArticle,
} from '../../wiki/wikiAPI';
import { promiseSequence } from '../../utilities';
/**
 * [[קטגוריה:ספורטאים זרים בישראל לפי ארץ מוצא|איווארים]]
[[קטגוריה:ספורטאים איווארים זרים לפי מדינה|ישראל]]
 */

const REPLACE_REGEX = /\[\[קטגוריה:ספורטאים (?:[^()[\] ]+ )+(ב[^()[\] ]+(?: [^ב()[\]][^[\]() ]+)*)/g;

type Category = {
  name: string;
  size: number;
}
async function main() {
  const generator = categoriesStartsWith('ספורטאים ');
  let res: IteratorResult<any, void>;
  const pages: Category[] = [];
  const parents: Category[] = [];
  const allcategories: Category[] = [];
  do {
    res = await generator.next();
    res?.value.query.allcategories.forEach((page) => {
      const name:string = page['*'];
      allcategories.push({
        name,
        size: page.size,
      });
      if (name.match(/^ספורטאים ([^() ]+ )+ב[^() ]+( [^() ]+)*$/)
       && !name.match(/ספורטאים ש[^ו]/)
        && !name.match(/אולימפ|להט"ב| זרים /)) {
        pages.push({
          name,
          size: page.size,
        });
      }
      if (name.includes(' זרים ') && name.includes(' לפי ') && !name.startsWith('ספורטאים זרים לפי')) {
        parents.push(({
          name,
          size: page.size,
        }));
      }
    });
  } while (!('batchcomplete' in (res?.value ?? {})) && !res?.done);
  const pagesWithCategoriesForConvert: Record<string, {
    content: string,
    categories: string[]
  }> = {};
  for (const page of pages) {
    if (page.size < 3) {
      const sportPages = await categroyPages(page.name, 5000);
      await Promise.all(sportPages.map(async (p) => {
        const content = p.revisions?.[0].slots.main['*'];
        if (!content) {
          return;
        }

        if (!(p.title in pagesWithCategoriesForConvert)) {
          pagesWithCategoriesForConvert[p.title] = {
            content,
            categories: [],
          };
        }

        // const newContent = content.replace(REPLACE_REGEX, '[[קטגוריה:ספורטאים זרים $1');
        const newContent = content.replace(`[[קטגוריה:${page.name}`, (match) => match.replace(REPLACE_REGEX, '[[קטגוריה:ספורטאים זרים $1'));
        if (newContent !== content) {
          if (!(p.title in pagesWithCategoriesForConvert)) {
            pagesWithCategoriesForConvert[p.title] = {
              content,
              categories: [],
            };
          }
          pagesWithCategoriesForConvert[p.title].categories.push(page.name);
        }
      }));
      deletePage(`קטגוריה:${page.name}`, 'קטגוריה מיותרת').then(() => {
        console.log(`deleted: ${page.name}`);
      }).catch(() => {});
    }
  }

  await promiseSequence(
    30,
    Object.entries(pagesWithCategoriesForConvert)
      .map(([title, { content, categories }]) => async () => {
        let newContent = content;
        categories.forEach((category) => {
          newContent = newContent.replace(`[[קטגוריה:${category}`, (match) => match.replace(REPLACE_REGEX, '[[קטגוריה:ספורטאים זרים $1'));
        });
        if (newContent !== content) {
          console.log(`updating: ${title}`);
          await updateArticle(title, 'המרת קטגוריות', newContent);
        }
      }),
  );

  for (const page of allcategories) {
    if (page.size === 0) {
      console.log(`deleting: https://he.wikipedia.org/wiki/קטגוריה:${page.name.replace(/ /g, '_')}`);
      await deletePage(`קטגוריה:${page.name}`, 'קטגוריה ריקה');
    }
  }

  const text = [...pages, ...parents].map((p) => `* [[:קטגוריה:${p.name}]] - ${p.size} דפים וקטגוריות משנה`).join('\n');
  await updateArticle('user:sapper-bot/קטגוריות ספורטאים לפי מדינות', 'רשימה', text);
}

main();
