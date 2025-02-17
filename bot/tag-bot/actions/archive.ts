import { findTemplate, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { IWikiApi } from '../../wiki/WikiApi';
import { getInnerLinks } from '../../wiki/wikiLinkParser';

export default async function archiveParagraph(
  api: IWikiApi,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  paragraphContent: string,
  summary: string,
) {
  try {
    const archiveBox = findTemplate(pageContent, 'תיבת ארכיון', pageTitle);
    if (!archiveBox) {
      return { error: 'תיבת ארכיון לא נמצאה' };
    }
    const [archiveBoxContent] = getTemplateArrayData(archiveBox, 'תיבת ארכיון', pageTitle);
    if (!archiveBoxContent) {
      return { error: 'התוכן של תיבת הארכיון לא נמצא' };
    }
    const links = getInnerLinks(archiveBoxContent);
    const lastLink = links.at(-1)?.link;
    if (!lastLink) {
      return { error: 'קישור אחרון לא נמצא' };
    }
    const archiveTitle = lastLink.startsWith('/') ? `${pageTitle}${lastLink}` : lastLink;
    const lastArchiveContent = await api.articleContent(archiveTitle);
    await api.edit(archiveTitle, summary, `${lastArchiveContent.content}\n${paragraphContent}`, lastArchiveContent.revid);
    await api.edit(pageTitle, summary, pageContent.replace(paragraphContent, ''), pageRevId);
    return { success: 'הארכוב בוצע בהצלחה' };
  } catch (error) {
    console.error(error.message || error.data || error.toString());

    return { error: 'ארעה שגיאה במהלך האירכוב' };
  }
}
