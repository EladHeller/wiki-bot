import { IWikiApi } from '../wiki/WikiApi';
import { findTemplate, getTemplateData } from '../wiki/newTemplateParser';
import { getInnerLinks } from '../wiki/wikiLinkParser';

const SIMPLE_ARCHIVE_BOX_TEMPLATE = 'תיבת ארכיון';
const AUTO_ARCHIVE_BOX_TEMPLATE = 'תיבת ארכיון אוטומטי';

export async function getLastActiveArchiveLink(
  api: IWikiApi,
  archiveBoxContent: string,
  pageTitle: string,
  matchPrefix: boolean = false,
): Promise<string | null> {
  const links = getInnerLinks(archiveBoxContent);
  const reversedLinks = links.reverse();

  for (const link of reversedLinks) {
    const linkTitle = link.link;
    const archiveTitle = linkTitle.startsWith('/') ? `${pageTitle}${linkTitle}` : linkTitle;
    const fixedArchiveTitle = archiveTitle.replace(/\/$/, '');
    const shouldCheck = !matchPrefix || fixedArchiveTitle.startsWith(pageTitle);

    if (shouldCheck) {
      const articleContent = await api.info([fixedArchiveTitle]);
      if (articleContent[0]?.missing == null) {
        return fixedArchiveTitle;
      }
    }
  }

  return null;
}

export async function getArchiveTitle(
  api: IWikiApi,
  pageContent: string,
  pageTitle: string,
  matchPrefix: boolean = false,
): Promise<{ archiveTitle: string } | { error: string }> {
  const simpleArchiveBox = findTemplate(pageContent, SIMPLE_ARCHIVE_BOX_TEMPLATE, pageTitle);
  const autoArchiveBox = findTemplate(pageContent, AUTO_ARCHIVE_BOX_TEMPLATE, pageTitle);
  const archiveBox = simpleArchiveBox || autoArchiveBox;
  if (!archiveBox) {
    return { error: 'תיבת ארכיון לא נמצאה' };
  }
  const isSimpleArchiveBox = !!simpleArchiveBox;
  const { arrayData } = getTemplateData(
    archiveBox,
    isSimpleArchiveBox ? SIMPLE_ARCHIVE_BOX_TEMPLATE : AUTO_ARCHIVE_BOX_TEMPLATE,
    pageTitle,
  );
  const archiveBoxContent = arrayData?.[0];
  if (!archiveBoxContent) {
    return { error: 'התוכן של תיבת הארכיון לא נמצא' };
  }
  const archiveTitle = await getLastActiveArchiveLink(api, archiveBoxContent, pageTitle, matchPrefix);
  if (!archiveTitle) {
    return { error: 'לא נמצא דף ארכיון פעיל' };
  }

  return { archiveTitle };
}
