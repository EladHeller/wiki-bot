import { findTemplate, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { IWikiApi } from '../../wiki/WikiApi';
import { getInnerLinks } from '../../wiki/wikiLinkParser';

async function getLastActiveLink(
  api: IWikiApi,
  archiveBoxContent: string,
  pageTitle: string,
): Promise<string | null> {
  const links = getInnerLinks(archiveBoxContent);
  const reversedLinks = links.reverse();
  for (const link of reversedLinks) {
    const linkTitle = link.link;
    const archiveTitle = linkTitle.startsWith('/') ? `${pageTitle}${linkTitle}` : linkTitle;
    const articleContent = await api.info([archiveTitle]);
    if (articleContent[0]?.missing == null) {
      return archiveTitle;
    }
  }

  return null;
}

const archiveCommandRegex = /^ *(:)*@\[\[(?:(?:משתמש|user):)?Sapper-bot(?:\|Sapper-bot)?\]\] +ארכב:.*/im;
const archiveCommandRegexGlobal = /^ *(:)*@\[\[(?:(?:משתמש|user):)?Sapper-bot(?:\|Sapper-bot)?\]\] +ארכב:.*/gim;
export default async function archiveParagraph(
  api: IWikiApi,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  paragraphContent: string,
  summary: string,
  requestedUser: string,
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
    const archiveTitle = await getLastActiveLink(api, archiveBoxContent, pageTitle);
    if (!archiveTitle) {
      return { error: 'לא נמצא דף ארכיון פעיל' };
    }
    const lastArchiveContent = await api.articleContent(archiveTitle);
    let newContent = paragraphContent.replace(archiveCommandRegex, `אורכב לבקשת [[משתמש:${requestedUser}]].{{כ}} ~~~~`);
    newContent = newContent.replaceAll(archiveCommandRegexGlobal, '');
    newContent = newContent.replace(/\n{3,}/g, '\n\n');
    await api.edit(archiveTitle, summary, `${lastArchiveContent.content}\n${newContent}`, lastArchiveContent.revid);
    await api.edit(pageTitle, summary, pageContent.replace(paragraphContent, ''), pageRevId);
    return { success: 'הארכוב בוצע בהצלחה' };
  } catch (error) {
    console.error(error.message);

    return { error: 'ארעה שגיאה במהלך האירכוב' };
  }
}
