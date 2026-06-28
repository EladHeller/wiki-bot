import { IWikiApi } from '../../wiki/WikiApi';
import {
  findTemplate, getTemplateData, templateFromTemplateData,
} from '../../wiki/newTemplateParser';
import { getAllParagraphs, parseParagraph } from '../../wiki/paragraphParser';
import parseTableText from '../../wiki/wikiTableParser';
import {
  getArchiveTitle,
  getUndatedParagraphsToArchive,
  removeArchivedUndatedParagraphsFromTracker,
} from '../../utilities/archiveUtils';
import { getInnerLink } from '../../wiki/wikiLinkParser';
import {
  extractLastSignatureDate,
  extractFirstSignatureDate,
  isInactiveForDays,
} from '../../utilities/signatureUtils';
import { logger } from '../../utilities/logger';

export type ArchiveType = 'רבעון' | 'תבנית ארכיון' | 'תבנית ארכיון עם יעד' | 'מחיקה';
const CONFIG_PAGE_TITLE = 'ויקיפדיה:בוט/ארכוב דיונים';
export type PageToArchive = {
  page: string;
  statuses: string[];
  daysAfterLastActivity: number;
  archiveType: ArchiveType;
  archiveNavigatePage: string | null;
};

const SUMMARY_PREFIX = `[[${CONFIG_PAGE_TITLE}|בוט ארכוב דיונים]]`;

export interface IClosedDiscussionsArchiveBotModel {
  getPagesToArchive(): Promise<PageToArchive[]>;
  getArchivableParagraphs(pageTitle: string, validStatuses: string[], inactivityDays: number): Promise<string[]>;
  archive(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveType: ArchiveType,
    archiveNavigatePage: string,
  ): Promise<void>;
}

const TEMPLATE_NAME = 'מצב';

const ARCHIVE_TEMPLATE = 'ארכיון הדט';

async function getContentOrNull(wikiApi: IWikiApi, title: string) {
  const result = await wikiApi.articleContent(title).catch(() => null);
  if (!result?.content) {
    return null;
  }
  return result;
}
async function getContent(wikiApi: IWikiApi, title: string) {
  const result = await getContentOrNull(wikiApi, title);
  if (!result) {
    throw new Error(`Missing content for ${title}`);
  }
  return result;
}

function getStatusTemplateData(
  paragraphContent: string,
  pageTitle: string,
): { status: string; handler?: string; archive?: string } | null {
  const statusTemplate = findTemplate(paragraphContent, TEMPLATE_NAME, pageTitle);
  if (!statusTemplate) {
    return null;
  }

  const { arrayData, keyValueData } = getTemplateData(statusTemplate, TEMPLATE_NAME, pageTitle);
  if (!arrayData || arrayData.length === 0) {
    return null;
  }

  const status = arrayData[0].trim();
  const handler = arrayData.length > 1 ? arrayData[1].trim() : undefined;
  const archive = keyValueData?.['ארכוב']?.trim();

  return { status, handler, archive };
}

function hasValidStatusTemplate(
  paragraphContent: string,
  pageTitle: string,
  validStatuses: string[],
): boolean {
  const templateData = getStatusTemplateData(paragraphContent, pageTitle);
  if (!templateData) {
    return false;
  }

  return validStatuses.includes(templateData.status);
}

function createArchiveSummary(
  paragraphName: string,
  status: string,
  handler?: string,
  archive = true,
): string {
  const handlerPart = handler ? ` מטפל: [[user:${handler}|${handler}]].` : '';
  return `${SUMMARY_PREFIX}: ${archive ? 'ארכוב' : 'מחיקת'} "${paragraphName}", ${status}.${handlerPart}`;
}

function getQuarterFromDate(date: Date): { firstMonth: string; lastMonth: string; year: number } {
  const month = date.getMonth();
  const year = date.getFullYear();

  if (month >= 0 && month <= 2) {
    return { firstMonth: 'ינואר', lastMonth: 'מרץ', year };
  }
  if (month >= 3 && month <= 5) {
    return { firstMonth: 'אפריל', lastMonth: 'יוני', year };
  }
  if (month >= 6 && month <= 8) {
    return { firstMonth: 'יולי', lastMonth: 'ספטמבר', year };
  }
  return { firstMonth: 'אוקטובר', lastMonth: 'דצמבר', year };
}

function getArchivePageName(basePageTitle: string, date: Date): string {
  const quarter = getQuarterFromDate(date);
  return `${basePageTitle}/ארכיון ${quarter.firstMonth}-${quarter.lastMonth} ${quarter.year}`;
}

function removeParagraphsFromContent(pageContent: string, paragraphsToRemove: string[]): string {
  const newContent = paragraphsToRemove.reduce(
    (content, paragraph) => content.split(paragraph).join(''),
    pageContent,
  );
  if (newContent === pageContent) {
    return pageContent;
  }

  const cleanedContent = newContent.replace(/\n\n\n+/g, '\n\n');
  return cleanedContent.trim();
}

export default function ClosedDiscussionsArchiveBotModel(
  wikiApi: IWikiApi,
): IClosedDiscussionsArchiveBotModel {
  async function getPagesToArchive(): Promise<PageToArchive[]> {
    const { content } = await getContent(wikiApi, CONFIG_PAGE_TITLE);
    const parsedTable = parseTableText(content)[0];
    return parsedTable
      .rows.filter((row) => row.fields.length === 5 && !row.isHeader)
      .map((row) => {
        const page = getInnerLink(row.fields[0] as string)?.link;
        if (!page) {
          throw new Error(`Invalid page: ${row.fields[0]}`);
        }
        const archiveNavigatePage = getInnerLink(row.fields[4] as string)?.link ?? null;
        return {
          page,
          statuses: (row.fields[1] as string).split(',').map((status) => status.trim()) as string[],
          daysAfterLastActivity: parseInt(row.fields[2] as string, 10),
          archiveType: (row.fields[3] as ArchiveType),
          archiveNavigatePage,
        };
      });
  }

  async function getArchivableParagraphs(
    pageTitle: string,
    validStatuses: string[],
    inactivityDays: number,
  ): Promise<string[]> {
    const { content } = await getContent(wikiApi, pageTitle);
    const allParagraphs = getAllParagraphs(content, pageTitle);
    const archivableBySignatureDate: string[] = [];
    const undatedParagraphs: string[] = [];

    allParagraphs.forEach((paragraph) => {
      if (!hasValidStatusTemplate(paragraph, pageTitle, validStatuses)) {
        return;
      }

      const lastSignatureDate = extractLastSignatureDate(paragraph);
      if (!lastSignatureDate) {
        undatedParagraphs.push(paragraph);
        return;
      }

      if (isInactiveForDays(lastSignatureDate, inactivityDays)) {
        archivableBySignatureDate.push(paragraph);
      }
    });

    const archivableUndatedParagraphs = await getUndatedParagraphsToArchive(
      wikiApi,
      pageTitle,
      undatedParagraphs,
      { type: 'inactivityDays', inactivityDays },
    );

    const archivableParagraphsSet = new Set([
      ...archivableBySignatureDate,
      ...archivableUndatedParagraphs.map((item) => item.paragraph),
    ]);

    return allParagraphs.filter((paragraph) => archivableParagraphsSet.has(paragraph));
  }

  async function archiveSingleParagraphTemplate(
    pageTitle: string,
    paragraph: string,
    archiveTitle: string,
    isTargeted: boolean,
    regularArchivePage = '',
  ): Promise<void> {
    const { name: paragraphName } = parseParagraph(paragraph);
    const templateData = getStatusTemplateData(paragraph, pageTitle);

    if (!templateData) {
      logger.logWarning(`No status template found for paragraph: ${pageTitle}: ${paragraphName}`);
      return;
    }

    const archiveSummary = createArchiveSummary(
      paragraphName,
      templateData.status,
      templateData.handler,
    );

    const existingArchiveContent = await getContentOrNull(wikiApi, archiveTitle);

    const statusTemplate = findTemplate(paragraph, TEMPLATE_NAME, pageTitle);
    const { keyValueData, arrayData } = getTemplateData(statusTemplate, TEMPLATE_NAME, pageTitle);
    delete keyValueData?.['ארכוב'];
    const newTemplate = templateFromTemplateData({ keyValueData, arrayData }, TEMPLATE_NAME);

    const parsedParagraph = parseParagraph(paragraph);
    const paragraphToArchive = isTargeted
      ? `==${parsedParagraph.name}==\n{{הועבר|מ=${pageTitle}}}\n${parsedParagraph.content.replace(statusTemplate, newTemplate)}\n{{סוף העברה}}`
      : paragraph;

    if (existingArchiveContent) {
      const newContent = `${existingArchiveContent.content}\n\n${paragraphToArchive}`;
      await wikiApi.edit(
        archiveTitle,
        archiveSummary,
        newContent,
        existingArchiveContent.revid,
      );
    } else {
      const newContent = `{{${ARCHIVE_TEMPLATE}}}\n\n${paragraphToArchive}`;
      await wikiApi.create(archiveTitle, archiveSummary, newContent);
    }

    const { content: sourceContent, revid: sourceRevid } = await getContent(wikiApi, pageTitle);

    const updatedContent = removeParagraphsFromContent(sourceContent, [paragraph]);
    await wikiApi.edit(pageTitle, archiveSummary, updatedContent, sourceRevid);

    if (isTargeted) {
      const { content, revid } = await getContent(wikiApi, regularArchivePage);
      const newContent = `${content}\n==${paragraphName}==\n${newTemplate}\n{{הועבר|ל=${archiveTitle}}}\n~~~~`;
      await wikiApi.edit(regularArchivePage, archiveSummary, newContent, revid);
    }
  }

  async function archiveSingleParagraphQuarterly(
    pageTitle: string,
    paragraph: string,
    firstDate: Date,
  ): Promise<void> {
    const templateData = getStatusTemplateData(paragraph, pageTitle);
    const { name: paragraphName } = parseParagraph(paragraph);

    if (!templateData) {
      logger.logWarning(`No status template found for paragraph: ${pageTitle}: ${paragraphName}`);
      return;
    }

    const archivePageName = getArchivePageName(pageTitle, firstDate);

    if (templateData.archive && templateData.archive !== 'ארכיון') {
      await archiveSingleParagraphTemplate(pageTitle, paragraph, templateData.archive, true, archivePageName);
      return;
    }

    const archiveSummary = createArchiveSummary(
      paragraphName,
      templateData.status,
      templateData.handler,
    );

    const existingContent = await getContentOrNull(wikiApi, archivePageName);

    if (existingContent) {
      const newContent = `${existingContent.content}\n\n${paragraph}`;
      await wikiApi.edit(
        archivePageName,
        archiveSummary,
        newContent,
        existingContent.revid,
      );
    } else {
      const newContent = `{{${ARCHIVE_TEMPLATE}}}\n\n${paragraph}`;
      await wikiApi.create(archivePageName, archiveSummary, newContent);
    }

    // Remove the paragraph from the source page
    const { content: sourceContent, revid: sourceRevid } = await getContent(wikiApi, pageTitle);
    const updatedContent = removeParagraphsFromContent(sourceContent, [paragraph]);
    await wikiApi.edit(pageTitle, archiveSummary, updatedContent, sourceRevid);
  }

  async function archiveWithQuarterlyAlgorithm(
    pageTitle: string,
    archivableParagraphs: string[],
  ): Promise<void> {
    const archivedParagraphs: string[] = [];
    try {
      for (const paragraph of archivableParagraphs) {
        const firstDate = extractFirstSignatureDate(paragraph) ?? new Date();
        await archiveSingleParagraphQuarterly(pageTitle, paragraph, firstDate);
        archivedParagraphs.push(paragraph);
      }
    } finally {
      await removeArchivedUndatedParagraphsFromTracker(wikiApi, pageTitle, archivedParagraphs);
    }
  }

  async function archiveWithTemplateAlgorithm(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveNavigatePage: string,
  ): Promise<void> {
    const navigateContent = await getContent(wikiApi, archiveNavigatePage);

    const archiveTitleResult = await getArchiveTitle(
      wikiApi,
      navigateContent.content,
      pageTitle,
      true,
    );

    if ('error' in archiveTitleResult) {
      throw new Error(`Failed to get archive title: ${archiveTitleResult.error}`);
    }

    const { archiveTitle } = archiveTitleResult;

    const archivedParagraphs: string[] = [];
    try {
      for (const paragraph of archivableParagraphs) {
        const templateData = getStatusTemplateData(paragraph, pageTitle);
        if (templateData?.archive && templateData.archive !== 'ארכיון') {
          await archiveSingleParagraphTemplate(pageTitle, paragraph, templateData.archive, true, archiveTitle);
        } else {
          await archiveSingleParagraphTemplate(pageTitle, paragraph, archiveTitle, false);
        }
        archivedParagraphs.push(paragraph);
      }
    } finally {
      await removeArchivedUndatedParagraphsFromTracker(wikiApi, pageTitle, archivedParagraphs);
    }
  }

  async function deleteParagraphs(pageTitle: string, archivableParagraphs: string[]): Promise<void> {
    const pageContentAndRevid = await getContent(wikiApi, pageTitle);
    let pageContent = pageContentAndRevid.content;
    let lastRevid = pageContentAndRevid.revid;
    for (const paragraph of archivableParagraphs) {
      const { name, content } = parseParagraph(paragraph);
      const templateData = getStatusTemplateData(content, pageTitle);
      if (templateData) {
        const archiveSummary = createArchiveSummary(
          name,
          templateData.status,
          templateData.handler,
          false,
        );
        const newContent = removeParagraphsFromContent(pageContent, [paragraph]);
        if (newContent !== pageContent) {
          pageContent = newContent;
          const { edit: { newrevid } } = await wikiApi.edit(pageTitle, archiveSummary, pageContent, lastRevid);
          if (newrevid) {
            lastRevid = newrevid;
          }
        }
      }
    }
  }

  async function archiveSingleParagraphWithTargetedArchive(
    pageTitle: string,
    paragraph: string,
    getDefaultArchiveTitle: () => Promise<string>,
  ): Promise<boolean> {
    const templateData = getStatusTemplateData(paragraph, pageTitle);
    if (!templateData?.archive) {
      return false;
    }

    const isDefaultArchive = templateData.archive === 'ארכיון';
    const defaultArchiveTitle = await getDefaultArchiveTitle();
    const archiveTitle = isDefaultArchive
      ? defaultArchiveTitle
      : templateData.archive;

    await archiveSingleParagraphTemplate(pageTitle, paragraph, archiveTitle, !isDefaultArchive, defaultArchiveTitle);
    return true;
  }

  async function archiveWithTargetTemplateAlgorithm(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveNavigatePage: string,
  ): Promise<void> {
    const archivedParagraphs: string[] = [];
    let defaultArchiveTitle: string | null = null;

    const getDefaultArchiveTitle = async (): Promise<string> => {
      if (!defaultArchiveTitle) {
        const navigateContent = await getContent(wikiApi, archiveNavigatePage);
        const archiveTitleResult = await getArchiveTitle(
          wikiApi,
          navigateContent.content,
          pageTitle,
          true,
        );

        if ('error' in archiveTitleResult) {
          throw new Error(`Failed to get archive title: ${archiveTitleResult.error}`);
        }
        defaultArchiveTitle = archiveTitleResult.archiveTitle;
      }
      return defaultArchiveTitle;
    };

    try {
      for (const paragraph of archivableParagraphs) {
        const archived = await archiveSingleParagraphWithTargetedArchive(
          pageTitle,
          paragraph,
          getDefaultArchiveTitle,
        );
        if (archived) {
          archivedParagraphs.push(paragraph);
        }
      }
    } finally {
      await removeArchivedUndatedParagraphsFromTracker(wikiApi, pageTitle, archivedParagraphs);
    }
  }

  async function archive(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveType: ArchiveType,
    archiveNavigatePage: string,
  ): Promise<void> {
    if (archivableParagraphs.length === 0) {
      return;
    }

    if (archiveType === 'רבעון') {
      await archiveWithQuarterlyAlgorithm(pageTitle, archivableParagraphs);
    } else if (archiveType === 'תבנית ארכיון') {
      await archiveWithTemplateAlgorithm(pageTitle, archivableParagraphs, archiveNavigatePage);
    } else if (archiveType === 'תבנית ארכיון עם יעד') {
      await archiveWithTargetTemplateAlgorithm(pageTitle, archivableParagraphs, archiveNavigatePage);
    } else if (archiveType === 'מחיקה') {
      await deleteParagraphs(pageTitle, archivableParagraphs);
    } else {
      throw new Error(`Unknown archive type: ${archiveType}`);
    }
  }

  return {
    getArchivableParagraphs,
    archive,
    getPagesToArchive,
  };
}
