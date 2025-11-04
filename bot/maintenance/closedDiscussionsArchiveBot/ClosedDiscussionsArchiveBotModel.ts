import { IWikiApi } from '../../wiki/WikiApi';
import { findTemplate, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { getAllParagraphs } from '../../wiki/paragraphParser';

export interface IClosedDiscussionsArchiveBotModel {
  getArchivableParagraphs(pageTitle: string): Promise<string[]>;
  archive(pageTitle: string, archivableParagraphs: string[]): Promise<void>;
}

const TEMPLATE_NAME = 'מצב';
const VALID_STATUSES = ['הועבר', 'טופל'];

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

function hasValidStatusTemplate(
  paragraphContent: string,
  pageTitle: string,
): boolean {
  const statusTemplate = findTemplate(paragraphContent, TEMPLATE_NAME, pageTitle);
  if (!statusTemplate) {
    return false;
  }

  const templateData = getTemplateArrayData(statusTemplate, TEMPLATE_NAME, pageTitle);
  if (templateData.length === 0) {
    return false;
  }

  const firstParameter = templateData[0].trim();
  return VALID_STATUSES.includes(firstParameter);
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
  async function getArchivableParagraphs(pageTitle: string): Promise<string[]> {
    const { content } = await getContent(wikiApi, pageTitle);
    const allParagraphs = getAllParagraphs(content, pageTitle);

    return allParagraphs.filter((paragraph) => {
      if (!hasValidStatusTemplate(paragraph, pageTitle)) {
        return false;
      }

      const lastSignatureDate = extractLastSignatureDate(paragraph);
      return lastSignatureDate != null && isInactiveForDays(lastSignatureDate, inactivityDays);
    });
  }

  async function archive(pageTitle: string, archivableParagraphs: string[]): Promise<void> {
    if (archivableParagraphs.length === 0) {
      return;
    }

    const paragraphsWithDates = archivableParagraphs
      .map((paragraph) => ({
        paragraph,
        firstDate: extractFirstSignatureDate(paragraph),
      }))
      .filter((item): item is { paragraph: string; firstDate: Date } => item.firstDate != null);

    const paragraphsByArchivePage: Record<string, string[]> = paragraphsWithDates.reduce(
      (acc, { paragraph, firstDate }) => {
        const archivePageName = getArchivePageName(pageTitle, firstDate);
        if (!acc[archivePageName]) {
          acc[archivePageName] = [];
        }
        acc[archivePageName].push(paragraph);
        return acc;
      },
      {},
    );

    await Promise.all(
      Object.entries(paragraphsByArchivePage).map(async ([archivePageName, paragraphs]) => {
        const existingContent = await getContentOrNull(wikiApi, archivePageName);

        if (existingContent) {
          const newContent = `${existingContent.content}\n\n${paragraphs.join('\n\n')}`;
          await wikiApi.edit(
            archivePageName,
            'ארכוב דיונים שהסתיימו',
            newContent,
            existingContent.revid,
          );
        } else {
          const newContent = `{{${ARCHIVE_TEMPLATE}}}\n\n${paragraphs.join('\n\n')}`;
          await wikiApi.create(archivePageName, 'ארכוב דיונים שהסתיימו', newContent);
        }
      }),
    );

    const { content: originalContent, revid: originalRevid } = await getContent(wikiApi, pageTitle);
    const updatedContent = removeParagraphsFromContent(originalContent, archivableParagraphs);
    await wikiApi.edit(pageTitle, 'ארכוב דיונים שהסתיימו', updatedContent, originalRevid);
  }

  return {
    getArchivableParagraphs,
    archive,
  };
}
