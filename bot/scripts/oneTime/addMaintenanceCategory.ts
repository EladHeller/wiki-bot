import { promiseSequence } from '../../utilities';
import { getAllParagraphs } from '../../wiki/paragraphParser';
import { IWikiApi } from '../../wiki/WikiApi';
import { getInnerLinks } from '../../wiki/wikiLinkParser';

const PAGE_TITLE = 'משתמש:שלום1234321/רשימות קטגוריות לקטלוג';
export default async function addMaintenanceCategory(api: IWikiApi) {
  const LEVEL = 4;
  const { content: contentD } = await api.articleContent(PAGE_TITLE);
  const paragraphs = getAllParagraphs(contentD, PAGE_TITLE, LEVEL) ?? [];
  for (const paragraph of paragraphs) {
    const title = paragraph.match(/=+\s*(?<groupTitle>[א-ת ]+)=+/)?.groups?.groupTitle?.trim();
    const category = `קטגוריה:קטגוריות עם רשימת ערכים חסרים/מבוקשים ${title}`;
    const [info] = await api.info([category]);
    if (!title || 'invalid' in info || 'missing' in info) {
      console.error('missing title', paragraph, info);
    } else {
      const links = getInnerLinks(paragraph);

      await promiseSequence(50, links.map((link) => async () => {
        const { content, revid } = await api.articleContent(link.link);
        if (content.includes(category)) {
          console.log('already added', link.link, category);
        } else {
          const newContent = `${content}\n[[${category}]]`;
          await api.edit(link.link, `הוספת קטגורית תחזוקה - [[:${category}]] ([[מיוחד:הבדל/43664815|בקשה בוק:בב]])`, newContent, revid, undefined, true);
        }
      }));
    }
  }
}
