import { IWikiApi } from '../../wiki/WikiApi';
import { findTemplate, getTemplateArrayData, getTemplateKeyValueData } from '../../wiki/newTemplateParser';
import { getAllParagraphs } from '../../wiki/paragraphParser';
import { getInnerLink, getInnerLinks } from '../../wiki/wikiLinkParser';
import { extractLastSignatureDate, isInactiveForDays } from '../../utilities/signatureUtils';
import { getArchiveTitle } from '../../utilities/archiveUtils';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import { WikiPage } from '../../types';
import { logger, stringify } from '../../utilities/logger';

const ARCHIVE_BOX_TEMPLATE = 'תיבת ארכיון';
const AUTO_ARCHIVE_BOX_TEMPLATE = 'תיבת ארכיון אוטומטי';
const AUTO_ARCHIVE_TEMPLATE = 'בוט ארכוב אוטומטי';
const NO_ARCHIVE_TEMPLATE = 'לא לארכוב';
const BOT_NOTIFICATION_HEADER = '== הודעה מבוט הארכוב ==';
const DEFAULT_INACTIVITY_DAYS = 30;
const DEFAULT_ARCHIVE_HEADER = '{{ארכיון}}';
const DEFAULT_ARCHIVE_SIZE = 150000;

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

async function getPageInfo(wikiApi: IWikiApi, title: string): Promise<{ exists: boolean; size: number }> {
  const info = await wikiApi.info([title]);
  const page = info[0];
  return {
    exists: page?.missing == null,
    size: page?.length ?? 0,
  };
}

async function pageExists(wikiApi: IWikiApi, title: string): Promise<boolean> {
  const info = await getPageInfo(wikiApi, title);
  return info.exists;
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

  const match = lastPart.match(/^(.+?)(\d+)\/?$/);
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
  try {
    const { content, revid } = await getContent(api, talkPage);

    if (content.includes(BOT_NOTIFICATION_HEADER)) {
      logger.logWarning(`Skipping notification for ${talkPage}: already has bot notification`);
      return;
    }

    const notificationMessage = `\n${BOT_NOTIFICATION_HEADER}\n${message} ~~~~`;
    await api.edit(talkPage, '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב', content + notificationMessage, revid);
  } catch (error) {
    logger.logError(`Failed to notify user on ${talkPage}: ${stringify(error)}`);
  }
}

export default function UserTalkArchiveBotModel(
  wikiApi: IWikiApi,
): IUserTalkArchiveBotModel {
  function getConfigFromPageContent(pageTitle: string, content: string): UserTalkArchiveConfig | null {
    const template = findTemplate(content, AUTO_ARCHIVE_TEMPLATE, pageTitle)
      || findTemplate(content, AUTO_ARCHIVE_BOX_TEMPLATE, pageTitle);
    if (!template) {
      return null;
    }

    const params = getTemplateKeyValueData(template);

    const inactivityDaysStr = params['ימים מתגובה אחרונה']?.trim();
    const inactivityDays = inactivityDaysStr ? parseInt(inactivityDaysStr, 10) : DEFAULT_INACTIVITY_DAYS;

    const archiveBoxPageStr = params['מיקום תבנית תיבת ארכיון']?.trim();
    const archiveBoxPage = archiveBoxPageStr
      ? (getInnerLink(archiveBoxPageStr)?.link ?? archiveBoxPageStr)
      : pageTitle;

    const directArchivePageStr = params['מיקום דף ארכיון אחרון']?.trim();
    const directArchivePage = directArchivePageStr
      ? (getInnerLink(directArchivePageStr)?.link ?? directArchivePageStr)
      : null;

    const maxArchiveSizeStr = params['גודל דף ארכיון']?.trim().replace(/,/g, '');
    const maxArchiveSize = maxArchiveSizeStr ? parseInt(maxArchiveSizeStr, 10) : DEFAULT_ARCHIVE_SIZE;

    const archiveHeaderStr = params['ראש דף ארכיון']?.trim();
    const archiveHeader = archiveHeaderStr || DEFAULT_ARCHIVE_HEADER;

    const createNewArchiveStr = params['יצירת דף ארכיון חדש']?.trim();
    const createNewArchive = createNewArchiveStr !== 'לא';

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
      await wikiApi.edit(archiveTitle, archiveSummary, newContent, existingArchiveContent.revid);
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
    const simpleArchiveBox = findTemplate(content, ARCHIVE_BOX_TEMPLATE, archiveBoxPage);
    const autoArchiveBox = findTemplate(content, AUTO_ARCHIVE_BOX_TEMPLATE, archiveBoxPage);
    const isSimpleArchiveBox = !!simpleArchiveBox;
    const archiveBox = simpleArchiveBox || autoArchiveBox;
    if (!archiveBox) {
      throw new Error('תיבת ארכיון לא נמצאה');
    }

    const [parameter] = getTemplateArrayData(
      archiveBox,
      isSimpleArchiveBox ? ARCHIVE_BOX_TEMPLATE : AUTO_ARCHIVE_BOX_TEMPLATE,
      archiveBoxPage,
      true,
    );
    const { prefix } = detectLinkStyle(parameter);
    const displayName = getDisplayName(newArchivePage);
    const archiveTitleLink = newArchivePage.startsWith(`${archiveBoxPage}/`) && !archiveBoxPage.includes('/')
      ? newArchivePage.slice(archiveBoxPage.length)
      : newArchivePage;
    const newArchiveLink = `${prefix}[[${archiveTitleLink}|${displayName}]]`;
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
    const template = findTemplate(content, AUTO_ARCHIVE_TEMPLATE, talkPage)
      || findTemplate(content, AUTO_ARCHIVE_BOX_TEMPLATE, talkPage);

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

  async function createNextArchivePage(
    currentArchiveTitle: string,
    archiveHeader: string,
    onNewArchiveCreated: (newArchiveTitle: string) => Promise<void>,
  ): Promise<string | null> {
    const newArchiveTitle = incrementArchivePageName(currentArchiveTitle);
    if (!newArchiveTitle) {
      return null;
    }

    const exists = await pageExists(wikiApi, newArchiveTitle);
    if (!exists) {
      await wikiApi.create(
        newArchiveTitle,
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: יצירת דף ארכיון חדש',
        archiveHeader,
      );
      await onNewArchiveCreated(newArchiveTitle);
    }

    return newArchiveTitle;
  }

  async function handleArchiveOverflow(
    talkPage: string,
    currentArchiveTitle: string,
    archiveHeader: string,
    createNewArchive: boolean,
    onNewArchiveCreated: (newArchiveTitle: string) => Promise<void>,
    notificationMessage: string,
  ): Promise<string | null> {
    if (!createNewArchive) {
      await notifyUserAboutArchive(wikiApi, talkPage, notificationMessage);
      return null;
    }

    const newArchiveTitle = await createNextArchivePage(currentArchiveTitle, archiveHeader, onNewArchiveCreated);
    if (!newArchiveTitle) {
      await notifyUserAboutArchive(
        wikiApi,
        talkPage,
        `דף הארכיון [[${currentArchiveTitle}]] מלא, אך לא ניתן ליצור דף חדש אוטומטית. יש ליצור דף ארכיון חדש ידנית.`,
      );
      return null;
    }

    return newArchiveTitle;
  }

  function collectBatchForArchive(
    paragraphs: string[],
    currentArchiveSize: number,
    maxArchiveSize: number,
  ): { batch: string[]; remaining: string[] } {
    let totalSize = currentArchiveSize;

    const splitIndex = paragraphs.findIndex((paragraph) => {
      const newSize = totalSize + paragraph.length;
      if (newSize > maxArchiveSize && totalSize > currentArchiveSize) {
        return true;
      }
      totalSize = newSize;
      return false;
    });

    if (splitIndex === -1) {
      return { batch: paragraphs, remaining: [] };
    }

    return {
      batch: paragraphs.slice(0, splitIndex),
      remaining: paragraphs.slice(splitIndex),
    };
  }

  async function performArchive(
    talkPage: string,
    archiveHeader: string,
    maxArchiveSize: number,
    createNewArchive: boolean,
    paragraphs: string[],
    strategy: ArchiveStrategy,
  ): Promise<void> {
    let currentArchiveTitle = strategy.archiveTitle;
    let remainingParagraphs = paragraphs;

    while (remainingParagraphs.length > 0) {
      const archiveInfo = await getPageInfo(wikiApi, currentArchiveTitle);

      if (archiveInfo.exists && archiveInfo.size >= maxArchiveSize) {
        const newTitle = await handleArchiveOverflow(
          talkPage,
          currentArchiveTitle,
          archiveHeader,
          createNewArchive,
          strategy.onNewArchiveCreated,
          strategy.maxSizeNotification,
        );
        if (!newTitle) return;
        currentArchiveTitle = newTitle;
      } else {
        const currentSize = archiveInfo.exists ? archiveInfo.size : 0;
        const { batch, remaining } = collectBatchForArchive(
          remainingParagraphs,
          currentSize,
          maxArchiveSize,
        );

        await archiveParagraphs(talkPage, batch, currentArchiveTitle, archiveHeader);
        remainingParagraphs = remaining;

        if (remaining.length > 0) {
          const newTitle = await handleArchiveOverflow(
            talkPage,
            currentArchiveTitle,
            archiveHeader,
            createNewArchive,
            strategy.onNewArchiveCreated,
            `דף הארכיון [[${currentArchiveTitle}]] הגיע לגודל המקסימלי ויש עוד תוכן לארכוב. יש ליצור דף ארכיון חדש.`,
          );
          if (!newTitle) return;
          currentArchiveTitle = newTitle;
        }
      }
    }
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
    if (page.title === `תבנית:${AUTO_ARCHIVE_BOX_TEMPLATE}`) {
      return;
    }
    const content = getPageContent(page);
    if (!content) {
      logger.logWarning(`No content found for ${page.title}`);
      return;
    }

    const config = getConfigFromPageContent(page.title, content);
    if (!config) {
      logger.logWarning(`No valid config found for ${page.title}`);
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
    const generator2 = wikiApi.getArticlesWithTemplate(AUTO_ARCHIVE_BOX_TEMPLATE, undefined, 'תבנית', '*');
    const generatorCallback = (page: WikiPage) => async () => {
      try {
        await processPage(page);
      } catch (error) {
        logger.logError(`Failed to process ${page.title}: ${stringify(error)}`);
      }
    };
    await asyncGeneratorMapWithSequence(
      5,
      generator,
      generatorCallback,
    );
    await asyncGeneratorMapWithSequence(
      5,
      generator2,
      generatorCallback,
    );
  }

  return {
    run,
    getConfigFromPageContent,
    getArchivableParagraphs,
    archive,
  };
}
