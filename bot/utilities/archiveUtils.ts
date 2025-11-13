import { IWikiApi } from '../wiki/WikiApi';
import { findTemplate, getTemplateArrayData } from '../wiki/newTemplateParser';
import { getInnerLinks } from '../wiki/wikiLinkParser';

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

    const shouldCheck = !matchPrefix || archiveTitle.startsWith(pageTitle);

    if (shouldCheck) {
      const articleContent = await api.info([archiveTitle]);
      if (articleContent[0]?.missing == null) {
        return archiveTitle;
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
  const archiveBox = findTemplate(pageContent, 'תיבת ארכיון', pageTitle);
  if (!archiveBox) {
    return { error: 'תיבת ארכיון לא נמצאה' };
  }
  const [archiveBoxContent] = getTemplateArrayData(archiveBox, 'תיבת ארכיון', pageTitle);
  if (!archiveBoxContent) {
    return { error: 'התוכן של תיבת הארכיון לא נמצא' };
  }
  const archiveTitle = await getLastActiveArchiveLink(api, archiveBoxContent, pageTitle, matchPrefix);
  if (!archiveTitle) {
    return { error: 'לא נמצא דף ארכיון פעיל' };
  }

  return { archiveTitle };
}
