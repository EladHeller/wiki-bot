import { IWikiApi } from '../../wiki/WikiApi';
import { findTemplate, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { getAllParagraphs, parseParagraph } from '../../wiki/paragraphParser';
import parseTableText from '../../wiki/wikiTableParser';
import { getArchiveTitle } from '../../utilities/archiveUtils';
import { getInnerLink } from '../../wiki/wikiLinkParser';

export type ArchiveType = 'רבעון' | 'תבנית ארכיון';
const CONFIG_PAGE_TITLE = 'ויקיפדיה:בוט/ארכוב דיונים';
export type PageToArchive = {
  page: string;
  statuses: string[];
  daysAfterLastActivity: number;
  archiveType: ArchiveType;
  archiveNavigatePage: string | null;
};

export interface IClosedDiscussionsArchiveBotModel {
  getPagesToArchive(): Promise<PageToArchive[]>;
  getArchivableParagraphs(pageTitle: string, validStatuses: string[]): Promise<string[]>;
  archive(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveType: ArchiveType,
    archiveNavigatePage: string,
  ): Promise<void>;
}

const TEMPLATE_NAME = 'מצב';

const hebrewMonthNames: Record<string, number> = {
  ינואר: 0,
  פברואר: 1,
  מרץ: 2,
  אפריל: 3,
  מאי: 4,
  יוני: 5,
  יולי: 6,
  אוגוסט: 7,
  ספטמבר: 8,
  אוקטובר: 9,
  נובמבר: 10,
  דצמבר: 11,
};

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
): { status: string; handler?: string } | null {
  const statusTemplate = findTemplate(paragraphContent, TEMPLATE_NAME, pageTitle);
  if (!statusTemplate) {
    return null;
  }

  const templateData = getTemplateArrayData(statusTemplate, TEMPLATE_NAME, pageTitle);
  if (templateData.length === 0) {
    return null;
  }

  const status = templateData[0].trim();
  const handler = templateData.length > 1 ? templateData[1].trim() : undefined;

  return { status, handler };
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
): string {
  const handlerPart = handler ? ` מטפל: ${handler}.` : '';
  return `ארכוב "${paragraphName}", ${status}.${handlerPart}`;
}

function extractSignatureDates(paragraphContent: string): Date[] {
  const signatureRegex = /(\d{1,2}):(\d{2}),\s+(\d{1,2})\s+ב([א-ת]+)\s+(\d{4})/gu;

  return Array.from(paragraphContent.matchAll(signatureRegex))
    .map((match) => {
      const day = parseInt(match[3], 10);
      const monthName = match[4];
      const year = parseInt(match[5], 10);
      const monthIndex = hebrewMonthNames[monthName];

      return monthIndex != null ? new Date(year, monthIndex, day) : null;
    })
    .filter((date): date is Date => date != null)
    .sort((a, b) => a.getTime() - b.getTime());
}

function extractLastSignatureDate(paragraphContent: string): Date | null {
  const dates = extractSignatureDates(paragraphContent);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

function extractFirstSignatureDate(paragraphContent: string): Date | null {
  const dates = extractSignatureDates(paragraphContent);
  return dates[0];
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

function isInactiveForDays(lastActivityDate: Date, days: number): boolean {
  const now = new Date();
  const diffInMs = now.getTime() - lastActivityDate.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  return diffInDays >= days;
}

function removeParagraphsFromContent(pageContent: string, paragraphsToRemove: string[]): string {
  const newContent = paragraphsToRemove.reduce(
    (content, paragraph) => content.replace(paragraph, ''),
    pageContent,
  );

  const cleanedContent = newContent.replace(/\n\n\n+/g, '\n\n');
  return cleanedContent.trim();
}

export default function ClosedDiscussionsArchiveBotModel(
  wikiApi: IWikiApi,
  inactivityDays: number = 14,
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
  ): Promise<string[]> {
    const { content } = await getContent(wikiApi, pageTitle);
    const allParagraphs = getAllParagraphs(content, pageTitle);

    return allParagraphs.filter((paragraph) => {
      if (!hasValidStatusTemplate(paragraph, pageTitle, validStatuses)) {
        return false;
      }

      const lastSignatureDate = extractLastSignatureDate(paragraph);
      return lastSignatureDate != null && isInactiveForDays(lastSignatureDate, inactivityDays);
    });
  }

  async function archiveSingleParagraphQuarterly(
    pageTitle: string,
    paragraph: string,
    firstDate: Date,
  ): Promise<void> {
    const archivePageName = getArchivePageName(pageTitle, firstDate);
    const { name: paragraphName } = parseParagraph(paragraph);
    const templateData = getStatusTemplateData(paragraph, pageTitle);

    if (!templateData) {
      console.warn(`No status template found for paragraph: ${paragraphName}`);
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
    const paragraphsWithDates = archivableParagraphs
      .map((paragraph) => ({
        paragraph,
        firstDate: extractFirstSignatureDate(paragraph),
      }))
      .filter((item): item is { paragraph: string; firstDate: Date } => item.firstDate != null);

    for (const { paragraph, firstDate } of paragraphsWithDates) {
      await archiveSingleParagraphQuarterly(pageTitle, paragraph, firstDate);
    }
  }

  async function archiveSingleParagraphTemplate(
    pageTitle: string,
    paragraph: string,
    archiveTitle: string,
  ): Promise<void> {
    const { name: paragraphName } = parseParagraph(paragraph);
    const templateData = getStatusTemplateData(paragraph, pageTitle);

    if (!templateData) {
      console.warn(`No status template found for paragraph: ${paragraphName}`);
      return;
    }

    const archiveSummary = createArchiveSummary(
      paragraphName,
      templateData.status,
      templateData.handler,
    );

    const existingArchiveContent = await getContentOrNull(wikiApi, archiveTitle);

    if (existingArchiveContent) {
      const newContent = `${existingArchiveContent.content}\n\n${paragraph}`;
      await wikiApi.edit(
        archiveTitle,
        archiveSummary,
        newContent,
        existingArchiveContent.revid,
      );
    } else {
      const newContent = `{{${ARCHIVE_TEMPLATE}}}\n\n${paragraph}`;
      await wikiApi.create(archiveTitle, archiveSummary, newContent);
    }

    // Remove the paragraph from the source page
    const { content: sourceContent, revid: sourceRevid } = await getContent(wikiApi, pageTitle);
    const updatedContent = removeParagraphsFromContent(sourceContent, [paragraph]);
    await wikiApi.edit(pageTitle, archiveSummary, updatedContent, sourceRevid);
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

    for (const paragraph of archivableParagraphs) {
      await archiveSingleParagraphTemplate(pageTitle, paragraph, archiveTitle);
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
