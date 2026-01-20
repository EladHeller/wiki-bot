import { findTemplate } from '../../wiki/newTemplateParser';
import { IWikiApi } from '../../wiki/WikiApi';
import { getInnerLink } from '../../wiki/wikiLinkParser';
import { getArchiveTitle } from '../../utilities/archiveUtils';

const archiveCommandRegex = /^ *(:)*@\[\[(?:(?:משתמש|user):)?Sapper-bot(?:\|Sapper-bot)?\]\] +ארכב(\s+ל)?:.*/im;
const archiveCommandRegexGlobal = /^ *(:)*@\[\[(?:(?:משתמש|user):)?Sapper-bot(?:\|Sapper-bot)?\]\] +ארכב(\s+ל)?:.*/gim;
const moveCommandRegexGlobal = /^ *(:)*@\[\[(?:(?:משתמש|user):)?Sapper-bot(?:\|Sapper-bot)?\]\] +העבר:.*/gim;

async function innerMove(
  api: IWikiApi,
  requestedUser: string,
  paragraphContent: string,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  summary: string,
  target: string,
  isArchive: boolean,
): Promise<{ targetPage: string }> {
  const targetPage = getInnerLink(target)?.link || target;
  const [title] = paragraphContent.trim().split('\n');

  let targetPageContent: {
    content: string;
    revid: number;
  } | null = null;
  const info = await api.info([targetPage]);
  if (info[0].missing == null) {
    targetPageContent = await api.articleContent(targetPage);
  }

  const tagRegexGlobal = isArchive ? archiveCommandRegexGlobal : moveCommandRegexGlobal;
  const signature = isArchive ? 'אורכב לבקשת' : 'הועבר לבקשת';

  let targetNewContent = paragraphContent.replaceAll(tagRegexGlobal, '');
  targetNewContent = targetNewContent.replace(`${title}\n`, '');
  targetNewContent = targetNewContent.replace(/\n{3,}/g, '\n\n');
  const targetNewParagraphContent = `${title}\n{{הועבר|מ=${pageTitle}}}\n${targetNewContent}\n{{סוף העברה}} ${signature} [[משתמש:${requestedUser}]].{{כ}} ~~~~`;

  if (targetPageContent != null) {
    await api.edit(targetPage, `${summary}. הועבר מ[[${pageTitle}]]`, `${targetPageContent.content}\n${targetNewParagraphContent}`, targetPageContent.revid);
  } else {
    await api.create(targetPage, `${summary}. הועבר מ[[${pageTitle}]]`, targetNewParagraphContent);
  }

  await api.edit(pageTitle, `${summary}. הועבר ל[[${targetPage}]]`, pageContent.replace(paragraphContent, ''), pageRevId);
  return { targetPage };
}

async function regularArchive(
  api: IWikiApi,
  archiveTitle: string,
  requestedUser: string,
  paragraphContent: string,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  archiveContent: { content: string, revid: number },
  summary: string,
): Promise<{ error: string } | { success: string }> {
  let newContent = paragraphContent.replace(archiveCommandRegex, `אורכב לבקשת [[משתמש:${requestedUser}]].{{כ}} ~~~~`);
  newContent = newContent.replaceAll(archiveCommandRegexGlobal, '');
  newContent = newContent.replace(/\n{3,}/g, '\n\n');
  await api.edit(archiveTitle, summary, `${archiveContent.content}\n${newContent}`, archiveContent.revid);
  await api.edit(pageTitle, summary, pageContent.replace(paragraphContent, ''), pageRevId);
  return { success: 'הארכוב בוצע בהצלחה' };
}

async function archiveTo(
  api: IWikiApi,
  archiveTitle: string,
  requestedUser: string,
  paragraphContent: string,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  archiveContent: { content: string, revid: number },
  summary: string,
  target: string,
): Promise<{ error: string } | { success: string }> {
  const [title] = paragraphContent.trim().split('\n');
  const statusTemplate = findTemplate(paragraphContent, 'מצב', pageTitle);

  const { targetPage } = await innerMove(
    api,
    requestedUser,
    paragraphContent,
    pageContent,
    pageRevId,
    pageTitle,
    summary,
    target,
    true,
  );

  const newArchivePageContent = `${title}\n${statusTemplate}\n{{הועבר|ל=${targetPage}}} אורכב לבקשת [[משתמש:${requestedUser}]].{{כ}} ~~~~`;
  await api.edit(archiveTitle, summary, `${archiveContent.content}\n${newArchivePageContent}`, archiveContent.revid);

  return { success: 'הארכוב בוצע בהצלחה' };
}

export async function moveTo(
  api: IWikiApi,
  requestedUser: string,
  paragraphContent: string,
  pageContent: string,
  pageRevId: number,
  pageTitle: string,
  summary: string,
  target: string,
): Promise<{ error: string } | { success: string }> {
  await innerMove(
    api,
    requestedUser,
    paragraphContent,
    pageContent,
    pageRevId,
    pageTitle,
    summary,
    target,
    false,
  );
  return { success: 'ההעברה בוצעה בהצלחה' };
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
): Promise<{ error: string } | { success: string }> {
  const archiveTitleResult = await getArchiveTitle(api, pageContent, pageTitle, false);
  if ('error' in archiveTitleResult) {
    return { error: archiveTitleResult.error };
  }
  const { archiveTitle } = archiveTitleResult;
  const lastArchiveContent = await api.articleContent(archiveTitle);
  if (type === 'ל' && target) {
    return archiveTo(
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
  }
  if (!target) {
    return regularArchive(
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
  }
  return { error: 'הועברו פרמטרים לא תקינים' };
}
