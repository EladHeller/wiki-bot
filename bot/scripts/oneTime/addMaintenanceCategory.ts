import { IWikiApi } from '../../wiki/WikiApi';
import { getInnerLinks } from '../../wiki/wikiLinkParser';

const skipUntil = '';

export default async function main(api: IWikiApi) {
  const { content: contentD } = await api.articleContent('משתמש:שלום1234321/רשימות קטגוריות לקטלוג');
  let shouldSkip = false;
  const paragraphs = contentD.match(/=+\s*[א-ת ]+=+[^=]+/gm) ?? [];
  for (const paragraph of paragraphs) {
    const title = paragraph.match(/=+\s*(?<groupTitle>[א-ת ]+)=+/)?.groups?.groupTitle?.trim();
    const category = `קטגוריה:קטגוריות עם רשימת ערכים חסרים/מבוקשים ${title}`;
    const [info] = await api.info([category]);
    if (!title || 'invalid' in info || 'missing' in info) {
      console.error('missing title', paragraph, info);
    } else {
      const links = getInnerLinks(paragraph);
      for (const link of links) {
        if (shouldSkip) {
          if (link.link === skipUntil) {
            shouldSkip = false;
          }
        } else {
          const { content, revid } = await api.articleContent(link.link);
          if (content.includes(category)) {
            console.log('already added', link.link, category);
          } else {
            const newContent = `${content}\n[[${category}]]`;
            await api.edit(link.link, `הוספת קטגורית תחזוקה - [[:${category}]] ([[מיוחד:הבדל/43664815|בקשה בוק:בב]])`, newContent, revid, undefined, true);
          }
        }
      }
    }
  }
}
