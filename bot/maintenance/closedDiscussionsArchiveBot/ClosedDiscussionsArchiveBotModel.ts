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
export type TargetedArchiveRegularArchiveMode = 'תבנית הועבר' | 'ארכוב כפול';
const CONFIG_PAGE_TITLE = 'ויקיפדיה:בוט/ארכוב דיונים';
export type PageToArchive = {
  page: string;
  statuses: string[];
  daysAfterLastActivity: number;
  archiveType: ArchiveType;
  archiveNavigatePage: string | null;
  targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode;
  addNewState: boolean;
  updateInDiscussionState: boolean;
};

const SUMMARY_PREFIX = `[[${CONFIG_PAGE_TITLE}|בוט ארכוב דיונים]]`;

export interface IClosedDiscussionsArchiveBotModel {
  getPagesToArchive(): Promise<PageToArchive[]>;
  getArchivableParagraphs(pageTitle: string, validStatuses: string[], inactivityDays: number): Promise<string[]>;
  archive(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveType: ArchiveType,
    archiveNavigatePage: string | null,
    targetedArchiveRegularArchiveMode?: TargetedArchiveRegularArchiveMode,
    addNewState?: boolean,
    updateInDiscussionState?: boolean,
  ): Promise<void>;
}

const TEMPLATE_NAME = 'מצב';
const NEW_STATE = 'חדש';
const IN_DISCUSSION_STATE = 'בדיון';

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

function archiveHeaderPerPage(title: string) {
  if (title === 'ויקיפדיה:העברת דפי טיוטה') {
    return '{{ארכיון הדט}}\n\n';
  }
  return '';
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
  return `${SUMMARY_PREFIX}: ${archive ? 'ארכוב' : 'מחיקת'} הדיון "${paragraphName}", ${status}.${handlerPart}`;
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

function createTransferredTemplate(target: string, direction: 'מ' | 'ל'): string {
  return `{{הועבר|${direction}=${target}}}`;
}

function createTargetedArchiveRegularContent(
  regularArchiveParagraph: string,
  paragraphName: string,
  archiveTitle: string,
): string {
  return `${regularArchiveParagraph}\n==${paragraphName}==\n${createTransferredTemplate(archiveTitle, 'ל')}\n~~~~`;
}

function validateTargetedArchiveRegularArchiveMode(mode: string): mode is TargetedArchiveRegularArchiveMode {
  return mode === 'תבנית הועבר' || mode === 'ארכוב כפול';
}

function isYes(value: string | undefined): boolean {
  return value?.trim() === 'כן';
}

function getUniqueCommentersCount(paragraphContent: string): number {
  const commenterMatches = Array.from(paragraphContent.matchAll(
    /\[\[(?:משתמש(?:ת)?|user):([^\]|#]+)(?:\|[^\]]*)?\]\]|\{\{א\|([^}|]+)(?:\|[^}]*)?\}\}/giu,
  ));
  return new Set(
    commenterMatches
      .flatMap((match) => [match[1], match[2]])
      .filter((commenter): commenter is string => commenter != null)
      .map((commenter) => commenter.trim())
      .filter((commenter) => commenter !== ''),
  ).size;
}

function updateParagraphState(paragraph: string, addNewState: boolean, updateInDiscussionState: boolean): string {
  const parsedParagraph = parseParagraph(paragraph);
  const statusTemplate = findTemplate(parsedParagraph.content, TEMPLATE_NAME, parsedParagraph.name);
  const templateData = statusTemplate ? getTemplateData(statusTemplate, TEMPLATE_NAME, parsedParagraph.name) : null;
  const hasStatusTemplate = templateData?.arrayData != null && templateData.arrayData.length > 0;
  const commenterCount = getUniqueCommentersCount(parsedParagraph.content);

  if (!hasStatusTemplate && addNewState) {
    const updatedContent = `{{${TEMPLATE_NAME}|${NEW_STATE}}}\n${parsedParagraph.content}`;
    return paragraph.replace(parsedParagraph.content, updatedContent);
  }

  if (
    updateInDiscussionState
    && templateData?.arrayData?.[0]?.trim() === NEW_STATE
    && commenterCount > 1
  ) {
    const updatedTemplate = statusTemplate.replace(`${TEMPLATE_NAME}|${NEW_STATE}`, `${TEMPLATE_NAME}|${IN_DISCUSSION_STATE}`);
    const updatedContent = parsedParagraph.content.replace(statusTemplate, updatedTemplate);
    return paragraph.replace(parsedParagraph.content, updatedContent);
  }

  return paragraph;
}

function updatePageStates(pageContent: string, addNewState: boolean, updateInDiscussionState: boolean): string {
  return getAllParagraphs(pageContent, '').reduce((content, paragraph) => {
    const updatedParagraph = updateParagraphState(paragraph, addNewState, updateInDiscussionState);
    return updatedParagraph === paragraph ? content : content.split(paragraph).join(updatedParagraph);
  }, pageContent);
}

async function updateSourcePageStates(
  wikiApi: IWikiApi,
  pageTitle: string,
  addNewState: boolean,
  updateInDiscussionState: boolean,
): Promise<void> {
  if (!addNewState && !updateInDiscussionState) {
    return;
  }

  const sourcePage = await getContent(wikiApi, pageTitle);
  const updatedContent = updatePageStates(sourcePage.content, addNewState, updateInDiscussionState);
  if (updatedContent === sourcePage.content) {
    return;
  }

  await wikiApi.edit(
    pageTitle,
    `${SUMMARY_PREFIX}: עדכון מצבי דיון`,
    updatedContent,
    sourcePage.revid,
  );
}

export default function ClosedDiscussionsArchiveBotModel(
  wikiApi: IWikiApi,
): IClosedDiscussionsArchiveBotModel {
  async function getPagesToArchive(): Promise<PageToArchive[]> {
    const { content } = await getContent(wikiApi, CONFIG_PAGE_TITLE);
    const parsedTable = parseTableText(content)[0];
    return parsedTable
      .rows.filter((row) => row.fields.length >= 6 && !row.isHeader)
      .map((row) => {
        const page = getInnerLink(row.fields[0] as string)?.link;
        if (!page) {
          throw new Error(`Invalid page: ${row.fields[0]}`);
        }
        const archiveNavigatePage = getInnerLink(row.fields[4] as string)?.link ?? null;
        const archiveModeText = row.fields[5]?.toString().trim() || '';
        const isValidArchiveMode = validateTargetedArchiveRegularArchiveMode(archiveModeText);
        const targetedArchiveRegularArchiveMode = isValidArchiveMode ? archiveModeText : 'תבנית הועבר';
        const addNewState = isYes(row.fields[6]?.toString());
        const updateInDiscussionState = isYes(row.fields[7]?.toString());
        return {
          page,
          statuses: (row.fields[1] as string).split(',').map((status) => status.trim()) as string[],
          daysAfterLastActivity: parseInt(row.fields[2] as string, 10),
          archiveType: (row.fields[3] as ArchiveType),
          archiveNavigatePage,
          targetedArchiveRegularArchiveMode,
          addNewState,
          updateInDiscussionState,
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
    targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode = 'תבנית הועבר',
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
      ? `==${parsedParagraph.name}==\n${createTransferredTemplate(pageTitle, 'מ')}\n${parsedParagraph.content.replace(statusTemplate, newTemplate)}\n{{סוף העברה}}`
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
      await wikiApi.create(archiveTitle, archiveSummary, archiveHeaderPerPage(pageTitle) + paragraphToArchive);
    }

    const { content: sourceContent, revid: sourceRevid } = await getContent(wikiApi, pageTitle);

    const updatedContent = removeParagraphsFromContent(sourceContent, [paragraph]);
    await wikiApi.edit(pageTitle, archiveSummary, updatedContent, sourceRevid);

    if (isTargeted && regularArchivePage) {
      const { content, revid } = await getContent(wikiApi, regularArchivePage);
      const newContent = targetedArchiveRegularArchiveMode === 'ארכוב כפול'
        ? `${content}\n${paragraph}`
        : createTargetedArchiveRegularContent(content, paragraphName, archiveTitle);
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
      await wikiApi.create(archivePageName, archiveSummary, archiveHeaderPerPage(pageTitle) + paragraph);
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
    archiveNavigatePage: string | null,
    targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode,
  ): Promise<void> {
    if (!archiveNavigatePage) {
      throw new Error('archiveNavigatePage is required for template archive with target');
    }
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
          await archiveSingleParagraphTemplate(
            pageTitle,
            paragraph,
            templateData.archive,
            true,
            archiveTitle,
            targetedArchiveRegularArchiveMode,
          );
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
    getDefaultArchiveTitle: (() => Promise<string>) | null,
    targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode,
    regularArchivePage: string,
  ): Promise<boolean> {
    const templateData = getStatusTemplateData(paragraph, pageTitle);
    if (!templateData?.archive) {
      return false;
    }

    const isDefaultArchive = templateData.archive === 'ארכיון';
    const archiveTitle = isDefaultArchive
      ? await getDefaultArchiveTitle?.()
      : templateData.archive;

    if (!archiveTitle) {
      return false;
    }

    await archiveSingleParagraphTemplate(
      pageTitle,
      paragraph,
      archiveTitle,
      !isDefaultArchive,
      regularArchivePage,
      targetedArchiveRegularArchiveMode,
    );
    return true;
  }

  async function archiveWithTargetTemplateAlgorithm(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveNavigatePage: string | null,
    targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode,
  ): Promise<void> {
    if (!archiveNavigatePage) {
      throw new Error('archiveNavigatePage is required for template archive with target');
    }
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
        const regularArchivePage = await getDefaultArchiveTitle();
        const archived = await archiveSingleParagraphWithTargetedArchive(
          pageTitle,
          paragraph,
          getDefaultArchiveTitle,
          targetedArchiveRegularArchiveMode,
          regularArchivePage,
        );
        if (archived) {
          archivedParagraphs.push(paragraph);
        }
      }
    } finally {
      await removeArchivedUndatedParagraphsFromTracker(wikiApi, pageTitle, archivedParagraphs);
    }
  }

  async function archiveTargetedParagraphsInDeleteMode(
    pageTitle: string,
    archivableParagraphs: string[],
    targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode,
    regularArchivePage: string,
  ): Promise<string[]> {
    const archivedParagraphs: string[] = [];

    for (const paragraph of archivableParagraphs) {
      const archived = await archiveSingleParagraphWithTargetedArchive(
        pageTitle,
        paragraph,
        null,
        targetedArchiveRegularArchiveMode,
        regularArchivePage,
      );
      if (archived) {
        archivedParagraphs.push(paragraph);
      }
    }

    return archivedParagraphs;
  }

  async function getRegularArchivePageTitle(
    pageTitle: string,
    archiveNavigatePage: string,
  ): Promise<string> {
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
    return archiveTitleResult.archiveTitle;
  }

  async function archiveWithDeleteAlgorithm(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveNavigatePage: string | null,
    targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode,
  ): Promise<void> {
    const targetedParagraphs = archivableParagraphs.filter(
      (paragraph) => getStatusTemplateData(paragraph, pageTitle)?.archive != null,
    );
    const paragraphsToDelete = archivableParagraphs.filter(
      (paragraph) => getStatusTemplateData(paragraph, pageTitle)?.archive == null,
    );

    const regularArchivePage = archiveNavigatePage
      ? await getRegularArchivePageTitle(pageTitle, archiveNavigatePage)
      : '';

    const archivedParagraphs = await archiveTargetedParagraphsInDeleteMode(
      pageTitle,
      targetedParagraphs,
      targetedArchiveRegularArchiveMode,
      regularArchivePage,
    );

    if (paragraphsToDelete.length > 0) {
      await deleteParagraphs(pageTitle, paragraphsToDelete);
    }

    await removeArchivedUndatedParagraphsFromTracker(wikiApi, pageTitle, archivedParagraphs);
  }

  async function archive(
    pageTitle: string,
    archivableParagraphs: string[],
    archiveType: ArchiveType,
    archiveNavigatePage: string | null,
    targetedArchiveRegularArchiveMode: TargetedArchiveRegularArchiveMode = 'תבנית הועבר',
    addNewState = false,
    updateInDiscussionState = false,
  ): Promise<void> {
    await updateSourcePageStates(wikiApi, pageTitle, addNewState, updateInDiscussionState);

    if (archivableParagraphs.length === 0) {
      return;
    }

    if (archiveType === 'רבעון') {
      await archiveWithQuarterlyAlgorithm(pageTitle, archivableParagraphs);
    } else if (archiveType === 'תבנית ארכיון') {
      await archiveWithTemplateAlgorithm(
        pageTitle,
        archivableParagraphs,
        archiveNavigatePage,
        targetedArchiveRegularArchiveMode,
      );
    } else if (archiveType === 'תבנית ארכיון עם יעד') {
      await archiveWithTargetTemplateAlgorithm(
        pageTitle,
        archivableParagraphs,
        archiveNavigatePage,
        targetedArchiveRegularArchiveMode,
      );
    } else if (archiveType === 'מחיקה') {
      await archiveWithDeleteAlgorithm(
        pageTitle,
        archivableParagraphs,
        archiveNavigatePage,
        targetedArchiveRegularArchiveMode,
      );
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
