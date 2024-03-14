import { asyncGeneratorMapWithSequence, promiseSequence } from '../utilities';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import { findTemplates, getTemplateArrayData } from '../wiki/newTemplateParser';

const CATEGORY_NAME = 'ערכים עם קישור שפה לערך שכבר קיים בעברית';
const LANGUAGE_LINKS_TEMPLATE = 'קישור שפה';
const ADD_APOSTROPHES = 'מירכאות=כן';

function getLinkText(template: string, articleName: string, presentName?: string) {
  const addApostrophes = template.includes(ADD_APOSTROPHES);
  const isPresentNameBold = presentName?.startsWith("'''") && presentName.endsWith("'''");
  const isPresentNameItalic = !isPresentNameBold && presentName?.startsWith("''") && presentName.endsWith("''");
  const startAndEnd = `${addApostrophes ? '"' : ''}${isPresentNameBold ? "'''" : ''}${isPresentNameItalic ? "''" : ''}`;
  return `${startAndEnd}[[${articleName}${presentName ? `|${presentName}` : ''}]]${startAndEnd}`;
}

export async function parseContent(api: IWikiApi, title: string, content: string) {
  const templates = findTemplates(content, LANGUAGE_LINKS_TEMPLATE, title);

  let newContent = content;
  await promiseSequence(10, templates.map((template) => async () => {
    const [,, articleName, presentName] = getTemplateArrayData(
      template,
      LANGUAGE_LINKS_TEMPLATE,
      title,
      true,
    );
    const infoRes = await api.info([articleName]);
    if (infoRes[0] && infoRes[0].missing == null) {
      newContent = newContent.replace(template, getLinkText(template, articleName, presentName));
    }
  }));
  return newContent;
}

export default async function languageLinks() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.categroyPages(CATEGORY_NAME);

  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    console.log(`Checking ${page.title}`);
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.error(`No content for ${page.title}`);
      return;
    }

    const newContent = await parseContent(api, page.title, content);
    if (newContent !== content) {
      console.log(`Updating ${page.title}!!!!!!!!!`);
      await api.updateArticle(page.title, 'הסרת תבנית קישור שפה', newContent);
    }
  });
}
