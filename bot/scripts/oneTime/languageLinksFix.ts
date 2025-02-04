import fs from 'fs/promises';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import NewWikiApi from '../../wiki/NewWikiApi';
// import { getInnerLinks } from '../../wiki/wikiLinkParser';
import { parseContent } from '../../maintenance/languageLinks';
import WikiDataAPI from '../../wiki/WikidataAPI';

const RELEVANT_COMMENT = 'הסרת תבנית קישור שפה';
const BOT_NAME = 'Sapper-bot';

export async function fixMissingQuotation() {
  const api = NewWikiApi();
  await api.login();

  const pages = ['בילבורד הוט 100 (2023)', 'בילבורד הוט 100 (2020 ואילך)', 'Face Yourself'];

  for (const title of pages) {
    const revisions = await api.getArticleRevisions(title, 2);
    if (revisions[0].user !== BOT_NAME || revisions[0].comment !== RELEVANT_COMMENT) {
      console.log(`Bot revision is not the first for ${title}`);
      return;
    }
    const beforeContent = revisions[1].slots.main['*'];
    const wikiDataApi = WikiDataAPI();
    const parsedBefore = await parseContent(api, wikiDataApi, title, beforeContent, {});

    await api.updateArticle(title, 'הוספת מירכאות חסרות לקישורים', parsedBefore);
  }
}

export default async function fixLanguageLinks() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.userContributes('sapper-bot', 380);
  const titles = await asyncGeneratorMapWithSequence(1, generator, (contribution) => async () => {
    console.log(`Checking ${contribution.title}`);
    if (contribution.comment === RELEVANT_COMMENT) {
      const revisions = await api.getArticleRevisions(contribution.title, 10);
      const botRevisionIndex = revisions.findIndex((rev) => rev.user === BOT_NAME && rev.comment === RELEVANT_COMMENT);
      if (botRevisionIndex === -1 || botRevisionIndex > 8) {
        console.log(`Bot revision is ${botRevisionIndex} for ${contribution.title}`);
        return null;
      }
      const beforeContent = revisions[botRevisionIndex + 1].slots.main['*'];
      const afterContent = revisions[botRevisionIndex].slots.main['*'];
      const wikiDataApi = WikiDataAPI();
      const parsedContent = await parseContent(api, wikiDataApi, contribution.title, beforeContent, {});
      if (afterContent !== parsedContent) {
        console.log(`not equal ${contribution.title}`);
        if (botRevisionIndex === 0) {
          await api.updateArticle(contribution.title, 'החזרת תבנית קישור שפה', parsedContent);
          return null;
        }
        return contribution.title;
      }
      // const returnValue: string | null = null;
      // const beforeMatches = beforeContent.match(/מירכאות=כן/g);
      // const afterMatches = afterContent.match(/מירכאות=כן/g);
      // if ((beforeMatches && !afterMatches)
      // || (beforeMatches && afterMatches && beforeMatches.length < afterMatches.length)) {
      //   console.log(`Bot fault at ${contribution.title}`);
      //   returnValue = contribution.title;
      // }

      // const content = revisions[0].slots.main['*'];
      // let newContent = content;

      // const links = getInnerLinks(content);
      // links.forEach((link) => {
      //   if (link.text.startsWith("'''") && link.text.endsWith("'''")) {
      //     const isBold = link.text.startsWith("'''") && link.text.endsWith("'''");
      //     const newText = link.text.substring(isBold ? 3 : 2, link.text.length - (isBold ? 3 : 2));
      //     const styleText = isBold ? "'''" : "''";
      //     const newLink = `${styleText}[[${link.link}|${newText}]]${styleText}`;
      //     const oldLink = `[[${link.link}|${link.text}]]`;
      //     newContent = newContent.replace(oldLink, newLink);
      //   }
      // });

      // if (newContent !== content) {
      //   console.log(`Updating ${contribution.title}!!!!!!!!!`);
      //   await api.updateArticle(contribution.title, 'הוצאת עיצוב מטקסט הקישור', newContent);
      // }
      // return returnValue;
    }
    return null;
  });

  const filteredTitles = titles.filter((title) => title);
  await fs.writeFile('languageLinksFix.txt', filteredTitles.join('\n'));
}
