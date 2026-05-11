import { IWikiApi } from '../wiki/WikiApi';
import { findTemplate, getTemplateData } from '../wiki/newTemplateParser';
import { getInnerLinks } from '../wiki/wikiLinkParser';
import parseTableText, { buildTable } from '../wiki/wikiTableParser';
import { parseParagraph } from '../wiki/paragraphParser';
import { isInactiveForDays } from './signatureUtils';

const SIMPLE_ARCHIVE_BOX_TEMPLATE = 'תיבת ארכיון';
const AUTO_ARCHIVE_BOX_TEMPLATE = 'תיבת ארכיון אוטומטי';
const UNDATED_PARAGRAPH_TRACKER_PAGE = 'ויקיפדיה:בוט/ארכוב פסקאות ללא תאריך';
const UNDATED_PARAGRAPH_TRACKER_HEADERS = ['דף', 'כותרת פסקה', 'תאריך הוספה'];
const UNDATED_PARAGRAPH_TRACKER_SUMMARY = 'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך';

export type ArchiveTitleError = 'תיבת ארכיון לא נמצאה' | 'התוכן של תיבת הארכיון לא נמצא' | 'לא נמצא דף ארכיון פעיל';
export type ArchiveTitleResult = { archiveTitle: string } | { error: ArchiveTitleError };
export type UndatedParagraphArchivePolicy = { type: 'inactivityDays'; inactivityDays: number } | {
  type: 'archiveMonth';
  archiveMonthDate: Date;
};
export type UndatedParagraphArchiveCandidate = {
  paragraph: string;
  paragraphTitle: string;
  firstSeenDate: Date;
};

type TrackerRow = {
  pageTitle: string;
  paragraphTitle: string;
  firstSeenDate: string;
};

function createTrackerKey(pageTitle: string, paragraphTitle: string): string {
  return `${pageTitle}\u0000${paragraphTitle}`;
}

function parseDateOrNull(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTrackerRows(trackerPageContent: string): TrackerRow[] {
  const table = parseTableText(trackerPageContent)[0];
  if (!table) {
    return [];
  }

  return table.rows
    .filter((row) => !row.isHeader && row.fields.length >= 3)
    .map((row) => ({
      pageTitle: String(row.fields[0]).trim(),
      paragraphTitle: String(row.fields[1]).trim(),
      firstSeenDate: String(row.fields[2]).trim(),
    }))
    .filter((row) => row.pageTitle !== '' && row.paragraphTitle !== '' && row.firstSeenDate !== '');
}

function buildTrackerTable(rows: TrackerRow[]): string {
  const sortedRows = [...rows].sort((a, b) => {
    const dateCompare = a.firstSeenDate.localeCompare(b.firstSeenDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    const pageCompare = a.pageTitle.localeCompare(b.pageTitle, 'he');
    if (pageCompare !== 0) {
      return pageCompare;
    }
    return a.paragraphTitle.localeCompare(b.paragraphTitle, 'he');
  });

  return buildTable(
    UNDATED_PARAGRAPH_TRACKER_HEADERS,
    sortedRows.map((row) => [row.pageTitle, row.paragraphTitle, row.firstSeenDate]),
    true,
  );
}

function updateTrackerTableText(content: string, newTableText: string): string {
  const table = parseTableText(content)[0];
  if (!table) {
    return [content.trim(), newTableText].filter(Boolean).join('\n\n');
  }
  return content.replace(table.text, newTableText);
}

function getParagraphTitleOrNull(paragraph: string): string | null {
  try {
    return parseParagraph(paragraph).name;
  } catch {
    return null;
  }
}

function shouldArchiveTrackedParagraph(firstSeenDate: Date, policy: UndatedParagraphArchivePolicy): boolean {
  if (policy.type === 'inactivityDays') {
    return isInactiveForDays(firstSeenDate, policy.inactivityDays);
  }
  const firstDayOfNextMonth = new Date(
    policy.archiveMonthDate.getFullYear(),
    policy.archiveMonthDate.getMonth() + 1,
    1,
  );
  return firstSeenDate < firstDayOfNextMonth;
}

async function trackerPageExists(api: IWikiApi): Promise<boolean> {
  const info = await api.info([UNDATED_PARAGRAPH_TRACKER_PAGE]);
  return info[0]?.missing == null;
}

async function loadTrackerRows(api: IWikiApi): Promise<{ rows: TrackerRow[]; revid: number | null }> {
  const exists = await trackerPageExists(api);
  if (!exists) {
    return { rows: [], revid: null };
  }
  const { content, revid } = await api.articleContent(UNDATED_PARAGRAPH_TRACKER_PAGE);
  return { rows: parseTrackerRows(content), revid };
}

async function saveTrackerRows(
  api: IWikiApi,
  rows: TrackerRow[],
  currentRevid: number | null,
): Promise<void> {
  const newTableText = buildTrackerTable(rows);

  if (currentRevid == null) {
    await api.create(UNDATED_PARAGRAPH_TRACKER_PAGE, UNDATED_PARAGRAPH_TRACKER_SUMMARY, newTableText);
    return;
  }

  const { content } = await api.articleContent(UNDATED_PARAGRAPH_TRACKER_PAGE);
  const updatedContent = updateTrackerTableText(content, newTableText);
  if (updatedContent === content) {
    return;
  }

  await api.edit(UNDATED_PARAGRAPH_TRACKER_PAGE, UNDATED_PARAGRAPH_TRACKER_SUMMARY, updatedContent, currentRevid);
}

export async function getUndatedParagraphsToArchive(
  api: IWikiApi,
  pageTitle: string,
  undatedParagraphs: string[],
  policy: UndatedParagraphArchivePolicy,
): Promise<UndatedParagraphArchiveCandidate[]> {
  if (undatedParagraphs.length === 0) {
    return [];
  }

  const { rows, revid } = await loadTrackerRows(api);
  const rowsByKey = new Map(rows.map((row) => [createTrackerKey(row.pageTitle, row.paragraphTitle), row]));
  const today = formatDate(new Date());

  const paragraphsToArchive: UndatedParagraphArchiveCandidate[] = [];
  let hasRowsChanges = false;

  undatedParagraphs.forEach((paragraph) => {
    const paragraphTitle = getParagraphTitleOrNull(paragraph);
    if (!paragraphTitle) {
      return;
    }

    const key = createTrackerKey(pageTitle, paragraphTitle);
    const existingRow = rowsByKey.get(key);

    if (!existingRow) {
      const newRow: TrackerRow = {
        pageTitle,
        paragraphTitle,
        firstSeenDate: today,
      };
      rowsByKey.set(key, newRow);
      rows.push(newRow);
      hasRowsChanges = true;
      return;
    }

    const firstSeenDate = parseDateOrNull(existingRow.firstSeenDate);
    if (!firstSeenDate) {
      existingRow.firstSeenDate = today;
      hasRowsChanges = true;
      return;
    }

    if (shouldArchiveTrackedParagraph(firstSeenDate, policy)) {
      paragraphsToArchive.push({
        paragraph,
        paragraphTitle,
        firstSeenDate,
      });
    }
  });

  if (hasRowsChanges) {
    await saveTrackerRows(api, rows, revid);
  }

  return paragraphsToArchive;
}

export async function removeArchivedUndatedParagraphsFromTracker(
  api: IWikiApi,
  pageTitle: string,
  archivedParagraphs: string[],
): Promise<void> {
  if (archivedParagraphs.length === 0) {
    return;
  }

  const { rows, revid } = await loadTrackerRows(api);
  if (rows.length === 0) {
    return;
  }

  const keysToDelete = new Set(
    archivedParagraphs
      .map(getParagraphTitleOrNull)
      .filter((paragraphTitle): paragraphTitle is string => paragraphTitle != null)
      .map((paragraphTitle) => createTrackerKey(pageTitle, paragraphTitle)),
  );
  if (keysToDelete.size === 0) {
    return;
  }

  const filteredRows = rows.filter(
    (row) => !keysToDelete.has(createTrackerKey(row.pageTitle, row.paragraphTitle)),
  );

  if (filteredRows.length === rows.length) {
    return;
  }

  await saveTrackerRows(api, filteredRows, revid);
}

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
): Promise<ArchiveTitleResult> {
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
