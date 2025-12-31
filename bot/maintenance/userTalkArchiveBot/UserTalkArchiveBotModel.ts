import { IWikiApi } from '../../wiki/WikiApi';
import { findTemplate, getTemplateArrayData, getTemplateKeyValueData } from '../../wiki/newTemplateParser';
import { getAllParagraphs } from '../../wiki/paragraphParser';
import { getInnerLink, getInnerLinks } from '../../wiki/wikiLinkParser';
import { extractLastSignatureDate, isInactiveForDays } from '../../utilities/signatureUtils';
import { getArchiveTitle } from '../../utilities/archiveUtils';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import { WikiPage } from '../../types';

const ARCHIVE_BOX_TEMPLATE = 'תיבת ארכיון';
const AUTO_ARCHIVE_TEMPLATE = 'בוט ארכוב אוטומטי';
const NO_ARCHIVE_TEMPLATE = 'לא לארכוב';
const BOT_NOTIFICATION_HEADER = '== הודעה מבוט הארכוב ==';
const DEFAULT_INACTIVITY_DAYS = 30;
const DEFAULT_ARCHIVE_HEADER = '{{ארכיון}}';
const DEFAULT_ARCHIVE_SIZE = 100000;

export interface UserTalkArchiveConfig {
  talkPage: string;
  inactivityDays: number;
  archiveBoxPage: string | null;
  directArchivePage: string | null;
  maxArchiveSize: number;
  archiveHeader: string;
  createNewArchive: boolean;
}

function getPageContent(page: WikiPage): string | null {
  const revision = page.revisions?.[0];
  return revision?.slots?.main?.['*'] ?? null;
}

export interface IUserTalkArchiveBotModel {
  run(): Promise<void>;
  getConfigFromPageContent(pageTitle: string, content: string): UserTalkArchiveConfig | null;
  getArchivableParagraphs(pageTitle: string, inactivityDays: number): Promise<string[]>;
  archive(config: UserTalkArchiveConfig, paragraphs: string[]): Promise<void>;
}

async function pageExists(wikiApi: IWikiApi, title: string): Promise<boolean> {
  const info = await wikiApi.info([title]);
  return info[0]?.missing == null;
}

async function getContentOrNull(wikiApi: IWikiApi, title: string) {
  const exists = await pageExists(wikiApi, title);
  if (!exists) {
    return null;
  }
  return wikiApi.articleContent(title);
}

async function getContent(wikiApi: IWikiApi, title: string) {
  const result = await getContentOrNull(wikiApi, title);
  if (!result) {
    throw new Error(`Missing content for ${title}`);
  }
  return result;
}

function removeParagraphsFromContent(pageContent: string, paragraphsToRemove: string[]): string {
  const newContent = paragraphsToRemove.reduce(
    (content, paragraph) => content.replace(paragraph, ''),
    pageContent,
  );

  const cleanedContent = newContent.replace(/\n\n\n+/g, '\n\n');
  return cleanedContent.trimEnd();
}

function incrementArchivePageName(archiveName: string): string | null {
  const parts = archiveName.split('/');
  const lastPart = parts[parts.length - 1];

  const match = lastPart.match(/^(.+?)(\d+)$/);
  if (!match) {
    return null;
  }

  const prefix = match[1];
  const number = parseInt(match[2], 10);
  const newLastPart = `${prefix}${number + 1}`;

  parts[parts.length - 1] = newLastPart;
  return parts.join('/');
}

async function getArchiveTitleFromBox(
  api: IWikiApi,
  archiveBoxPage: string,
  talkPage: string,
): Promise<{ archiveTitle: string } | { error: string }> {
  const boxContent = await getContent(api, archiveBoxPage);
  return getArchiveTitle(api, boxContent.content, talkPage);
}

async function notifyUserAboutArchive(
  api: IWikiApi,
  talkPage: string,
  message: string,
): Promise<void> {
  console.warn(`Failed to archive ${talkPage}: ${message}`);

  try {
    const { content, revid } = await getContent(api, talkPage);

    if (content.includes(BOT_NOTIFICATION_HEADER)) {
      console.warn(`Skipping notification for ${talkPage}: already has bot notification`);
      return;
    }

    const notificationMessage = `\n\n${BOT_NOTIFICATION_HEADER}\n${message} ~~~~`;
    await api.edit(talkPage, '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב', content + notificationMessage, revid);
  } catch (error) {
    console.error(`Failed to notify user on ${talkPage}:`, error);
  }
}

export default function UserTalkArchiveBotModel(
  wikiApi: IWikiApi,
): IUserTalkArchiveBotModel {
  function getConfigFromPageContent(pageTitle: string, content: string): UserTalkArchiveConfig | null {
    const template = findTemplate(content, AUTO_ARCHIVE_TEMPLATE, pageTitle);
    if (!template) {
      return null;
    }

    const params = getTemplateKeyValueData(template);

    const inactivityDaysStr = params['ימים מתגובה אחרונה']?.trim();
    const inactivityDays = inactivityDaysStr ? parseInt(inactivityDaysStr, 10) : DEFAULT_INACTIVITY_DAYS;

    const archiveBoxPageStr = params['מיקום תבנית תיבת ארכיון']?.trim();
    const archiveBoxPage = archiveBoxPageStr
      ? (getInnerLink(archiveBoxPageStr)?.link ?? archiveBoxPageStr)
      : null;

    const directArchivePageStr = params['מיקום דף ארכיון אחרון']?.trim();
    const directArchivePage = directArchivePageStr
      ? (getInnerLink(directArchivePageStr)?.link ?? directArchivePageStr)
      : null;

    const maxArchiveSizeStr = params['גודל דף ארכיון']?.trim();
    const maxArchiveSize = maxArchiveSizeStr ? parseInt(maxArchiveSizeStr, 10) : DEFAULT_ARCHIVE_SIZE;

    const archiveHeaderStr = params['ראש דף ארכיון']?.trim();
    const archiveHeader = archiveHeaderStr || DEFAULT_ARCHIVE_HEADER;

    const createNewArchiveStr = params['יצירת דף ארכיון חדש']?.trim();
    const createNewArchive = createNewArchiveStr !== 'לא';

    if (!archiveBoxPage && !directArchivePage) {
      return null;
    }

    return {
      talkPage: pageTitle,
      inactivityDays,
      archiveBoxPage,
      directArchivePage,
      maxArchiveSize,
      archiveHeader,
      createNewArchive,
    };
  }

  function hasNoArchiveTemplate(paragraph: string): boolean {
    return findTemplate(paragraph, NO_ARCHIVE_TEMPLATE, '') !== '';
  }

  async function getArchivableParagraphs(
    pageTitle: string,
    inactivityDays: number,
  ): Promise<string[]> {
    const { content } = await getContent(wikiApi, pageTitle);
    const allParagraphs = getAllParagraphs(content, pageTitle);

    return allParagraphs.filter((paragraph) => {
      if (hasNoArchiveTemplate(paragraph)) {
        return false;
      }
      const lastSignatureDate = extractLastSignatureDate(paragraph);
      return lastSignatureDate != null && isInactiveForDays(lastSignatureDate, inactivityDays);
    });
  }

  async function archiveParagraphs(
    talkPage: string,
    paragraphs: string[],
    archiveTitle: string,
    archiveHeader: string,
  ): Promise<void> {
    const archiveSummary = '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: ארכוב אוטומטי של דיונים ישנים';
    const paragraphsContent = paragraphs.join('\n\n');

    const existingArchiveContent = await getContentOrNull(wikiApi, archiveTitle);

    if (existingArchiveContent) {
      const newContent = `${existingArchiveContent.content}\n\n${paragraphsContent}`;
      await wikiApi.edit(
        archiveTitle,
        archiveSummary,
        newContent,
        existingArchiveContent.revid,
      );
    } else {
      const newContent = `${archiveHeader}\n\n${paragraphsContent}`;
      await wikiApi.create(archiveTitle, archiveSummary, newContent);
    }

    const { content: sourceContent, revid: sourceRevid } = await getContent(wikiApi, talkPage);
    const updatedContent = removeParagraphsFromContent(sourceContent, paragraphs);
    await wikiApi.edit(talkPage, archiveSummary, updatedContent, sourceRevid);
  }

  function detectLinkStyle(archiveBoxContent: string): { prefix: string; suffix: string } {
    const links = getInnerLinks(archiveBoxContent);
    if (links.length < 2) {
      const [firstLink] = links;
      const firstLinkIndex = archiveBoxContent.indexOf(`[[${firstLink.link}`);
      const prefix = archiveBoxContent.slice(0, firstLinkIndex).trim().split('\n').at(-1)
        ?.trim();
      return { prefix: prefix ? `\n${prefix}` : '\n#', suffix: '' };
    }

    const lastLink = links[links.length - 1];
    const secondLastLink = links[links.length - 2];

    const lastLinkStart = archiveBoxContent.lastIndexOf(`[[${lastLink.link}`);
    const secondLastLinkEnd = archiveBoxContent.indexOf(
      ']]',
      archiveBoxContent.lastIndexOf(`[[${secondLastLink.link}`),
    ) + 2;

    const separator = archiveBoxContent.slice(secondLastLinkEnd, lastLinkStart);
    const [, prefix] = separator.match(/^(\s*[*#]?\s*)/) as RegExpMatchArray;

    return { prefix, suffix: '' };
  }

  function getDisplayName(pagePath: string): string {
    const lastSlashIndex = pagePath.lastIndexOf('/');
    return lastSlashIndex >= 0 ? pagePath.slice(lastSlashIndex + 1) : pagePath;
  }

  async function updateArchiveBoxWithNewPage(
    api: IWikiApi,
    archiveBoxPage: string,
    newArchivePage: string,
  ): Promise<void> {
    const { content, revid } = await getContent(api, archiveBoxPage);
    const archiveBox = findTemplate(content, ARCHIVE_BOX_TEMPLATE, archiveBoxPage);

    if (!archiveBox) {
      throw new Error('תיבת ארכיון לא נמצאה');
    }

    const [parameter] = getTemplateArrayData(archiveBox, ARCHIVE_BOX_TEMPLATE, archiveBoxPage, true);
    const { prefix } = detectLinkStyle(parameter);
    const displayName = getDisplayName(newArchivePage);
    const newArchiveLink = `${prefix}[[${newArchivePage}|${displayName}]]`;
    const newParameter = parameter + newArchiveLink;

    await api.edit(
      archiveBoxPage,
      '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הוספת דף ארכיון חדש',
      content.replace(parameter, newParameter),
      revid,
    );
  }

  async function updateDirectArchiveTemplateParameter(
    talkPage: string,
    oldArchivePage: string,
    newArchivePage: string,
  ): Promise<void> {
    const { content, revid } = await getContent(wikiApi, talkPage);
    const template = findTemplate(content, AUTO_ARCHIVE_TEMPLATE, talkPage);

    if (!template) {
      throw new Error('תבנית בוט ארכוב אוטומטי לא נמצאה');
    }

    const updatedTemplate = template
      .replace(`[[${oldArchivePage}]]`, `[[${newArchivePage}]]`)
      .replace(oldArchivePage, newArchivePage);

    await wikiApi.edit(
      talkPage,
      '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: עדכון דף ארכיון חדש',
      content.replace(template, updatedTemplate),
      revid,
    );
  }

  interface ArchiveStrategy {
    archiveTitle: string;
    maxSizeNotification: string;
    onNewArchiveCreated: (newArchiveTitle: string) => Promise<void>;
  }

  async function performArchive(
    talkPage: string,
    archiveHeader: string,
    maxArchiveSize: number,
    createNewArchive: boolean,
    paragraphs: string[],
    strategy: ArchiveStrategy,
  ): Promise<void> {
    let { archiveTitle } = strategy;
    const existingArchiveContent = await getContentOrNull(wikiApi, archiveTitle);

    if (existingArchiveContent && existingArchiveContent.content.length >= maxArchiveSize) {
      if (!createNewArchive) {
        await notifyUserAboutArchive(wikiApi, talkPage, strategy.maxSizeNotification);
        return;
      }

      const newArchiveTitle = incrementArchivePageName(archiveTitle);

      if (!newArchiveTitle) {
        await notifyUserAboutArchive(
          wikiApi,
          talkPage,
          `דף הארכיון [[${archiveTitle}]] מלא, אך לא ניתן ליצור דף חדש אוטומטית. יש ליצור דף ארכיון חדש ידנית.`,
        );
        return;
      }

      const newArchiveExists = await pageExists(wikiApi, newArchiveTitle);

      if (!newArchiveExists) {
        await wikiApi.create(newArchiveTitle, '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: יצירת דף ארכיון חדש', archiveHeader);
        await strategy.onNewArchiveCreated(newArchiveTitle);
      }

      archiveTitle = newArchiveTitle;
    }

    await archiveParagraphs(talkPage, paragraphs, archiveTitle, archiveHeader);
  }

  async function archiveWithArchiveBox(
    talkPage: string,
    archiveBoxPage: string,
    archiveHeader: string,
    maxArchiveSize: number,
    createNewArchive: boolean,
    paragraphs: string[],
  ): Promise<void> {
    const archiveTitleResult = await getArchiveTitleFromBox(wikiApi, archiveBoxPage, talkPage);

    if ('error' in archiveTitleResult) {
      await notifyUserAboutArchive(wikiApi, talkPage, archiveTitleResult.error);
      return;
    }

    await performArchive(talkPage, archiveHeader, maxArchiveSize, createNewArchive, paragraphs, {
      archiveTitle: archiveTitleResult.archiveTitle,
      maxSizeNotification: `דף הארכיון [[${archiveTitleResult.archiveTitle}]] הגיע לגודל המקסימלי. יש ליצור דף ארכיון חדש ולעדכן את תיבת הארכיון.`,
      onNewArchiveCreated: (newArchiveTitle) => updateArchiveBoxWithNewPage(wikiApi, archiveBoxPage, newArchiveTitle),
    });
  }

  async function archiveWithDirectPage(
    talkPage: string,
    directArchivePage: string,
    archiveHeader: string,
    maxArchiveSize: number,
    createNewArchive: boolean,
    paragraphs: string[],
  ): Promise<void> {
    await performArchive(talkPage, archiveHeader, maxArchiveSize, createNewArchive, paragraphs, {
      archiveTitle: directArchivePage,
      maxSizeNotification: `דף הארכיון [[${directArchivePage}]] הגיע לגודל המקסימלי. יש ליצור דף ארכיון חדש ולעדכן את {{תב|בוט ארכוב אוטומטי}}.`,
      onNewArchiveCreated: (newArchiveTitle) => updateDirectArchiveTemplateParameter(
        talkPage,
        directArchivePage,
        newArchiveTitle,
      ),
    });
  }

  async function archive(config: UserTalkArchiveConfig, paragraphs: string[]): Promise<void> {
    if (paragraphs.length === 0) {
      return;
    }

    if (config.archiveBoxPage) {
      await archiveWithArchiveBox(
        config.talkPage,
        config.archiveBoxPage,
        config.archiveHeader,
        config.maxArchiveSize,
        config.createNewArchive,
        paragraphs,
      );
    } else if (config.directArchivePage) {
      await archiveWithDirectPage(
        config.talkPage,
        config.directArchivePage,
        config.archiveHeader,
        config.maxArchiveSize,
        config.createNewArchive,
        paragraphs,
      );
    } else {
      throw new Error('Either archive box page or direct archive page must be provided');
    }
  }

  async function processPage(page: WikiPage): Promise<void> {
    const content = getPageContent(page);
    if (!content) {
      console.warn(`No content found for ${page.title}`);
      return;
    }

    const config = getConfigFromPageContent(page.title, content);
    if (!config) {
      console.warn(`No valid config found for ${page.title}`);
      return;
    }

    const archivableParagraphs = await getArchivableParagraphs(
      config.talkPage,
      config.inactivityDays,
    );

    if (archivableParagraphs.length > 0) {
      await archive(config, archivableParagraphs);
    }
  }

  async function run(): Promise<void> {
    const generator = wikiApi.getArticlesWithTemplate(AUTO_ARCHIVE_TEMPLATE, undefined, 'תבנית', '*');

    await asyncGeneratorMapWithSequence(
      1,
      generator,
      (page) => async () => {
        try {
          await processPage(page);
        } catch (error) {
          console.error(`Failed to process ${page.title}:`, error);
        }
      },
    );
  }

  return {
    run,
    getConfigFromPageContent,
    getArchivableParagraphs,
    archive,
  };
}
