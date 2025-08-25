import { findTemplate, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { IWikiApi } from '../../wiki/WikiApi';
import { getInnerLink, getInnerLinks } from '../../wiki/wikiLinkParser';

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

async function regularArchive(
  api: IWikiApi,
  archiveTitle: string,
  requestedUser: string,
  paragraphContent: string,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  archiveContent: {content: string, revid: number},
  summary: string,
) {
  let newContent = paragraphContent.replace(archiveCommandRegex, `אורכב לבקשת [[משתמש:${requestedUser}]].{{כ}} ~~~~`);
  newContent = newContent.replaceAll(archiveCommandRegexGlobal, '');
  newContent = newContent.replace(/\n{3,}/g, '\n\n');
  await api.edit(archiveTitle, summary, `${archiveContent.content}\n${newContent}`, archiveContent.revid);
  await api.edit(pageTitle, summary, pageContent.replace(paragraphContent, ''), pageRevId);
}

async function getArchiveTitle(api: IWikiApi, pageContent: string, pageTitle: string) {
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

  return { archiveTitle };
}

async function archiveTo(
  api: IWikiApi,
  archiveTitle: string,
  requestedUser: string,
  paragraphContent: string,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  archiveContent: {content: string, revid: number},
  summary: string,
  target: string,
) {
  const targetPage = getInnerLink(target)?.link || target;
  const [title] = paragraphContent.trim().split('\n');
  const stateTemplate = findTemplate(paragraphContent, 'מצב', pageTitle);
  const targetPageContent = await api.articleContent(targetPage);

  const newArchivePageContent = `${title}\n${stateTemplate}\n{{הועבר|ל=${targetPage}}} אורכב לבקשת [[משתמש:${requestedUser}]].{{כ}} ~~~~`;
  await api.edit(archiveTitle, summary, `${archiveContent.content}\n${newArchivePageContent}`, archiveContent.revid);

  let targetNewContent = paragraphContent.replaceAll(archiveCommandRegexGlobal, '');
  targetNewContent = targetNewContent.replace(`${title}\n`, '');
  targetNewContent = targetNewContent.replace(/\n{3,}/g, '\n\n');
  const targetNewParagraphContent = `${title}\n{{הועבר|מ=${pageTitle}}}\n${targetNewContent}\n{{סוף העברה}} אורכב לבקשת [[משתמש:${requestedUser}]].{{כ}} ~~~~`;
  await api.edit(targetPage, `${summary}. הועבר מ[[${pageTitle}]]`, `${targetPageContent.content}\n${targetNewParagraphContent}`, targetPageContent.revid);

  await api.edit(pageTitle, `${summary}. הועבר ל[[${targetPage}]]`, pageContent.replace(paragraphContent, ''), pageRevId);
}

export default async function archiveParagraph(
  api: IWikiApi,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  paragraphContent: string,
  summary: string,
  requestedUser: string,
  [type, target]: (string | null)[] = [],
) {
  try {
    const { archiveTitle, error } = await getArchiveTitle(api, pageContent, pageTitle);
    if (!archiveTitle) {
      return { error };
    }
    const lastArchiveContent = await api.articleContent(archiveTitle);
    if (type === 'יעד' && target) {
      await archiveTo(
        api,
        archiveTitle,
        requestedUser,
        paragraphContent,
        pageContent,
        pageRevId,
        pageTitle,
        lastArchiveContent,
        summary,
        target,
      );
    } else if (!target) {
      await regularArchive(
        api,
        archiveTitle,
        requestedUser,
        paragraphContent,
        pageContent,
        pageRevId,
        pageTitle,
        lastArchiveContent,
        summary,
      );
    } else {
      return { error: 'הועברו פרמטרים לא תקינים' };
    }
    return { success: 'הארכוב בוצע בהצלחה' };
  } catch (error) {
    console.error(error.message);

    return { error: 'ארעה שגיאה במהלך האירכוב' };
  }
}
