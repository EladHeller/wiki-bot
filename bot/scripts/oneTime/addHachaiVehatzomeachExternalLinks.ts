import { getParagraphContent } from '../../wiki/paragraphParser';
import { findTemplate, getTemplateArrayData, templateFromArrayData } from '../../wiki/newTemplateParser';
import parseTableText, { TableData } from '../../wiki/wikiTableParser';
import { getInnerLinks } from '../../wiki/wikiLinkParser';
import { getRedirectTargetFromContent } from '../../wiki/redirectParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const SOURCE_PAGE = 'משתמש:פרוגנתודון/מש:פרוגנתודון/רשימת תחזוקה לשמות/חסרי חוליות';
// const TEMPLATE_NAME = 'החי והצומח';
const TEMPLATE_NAME = 'מילון אקדמיה';
const AUTHORITY_CONTROL_TEMPLATE = 'בקרת זהויות';
const STUB_TEMPLATE = 'קצרמר';
const EXTERNAL_LINKS_HEADING = 'קישורים חיצוניים';
const EXPLANATIONS_HEADING = 'ביאורים';
const REFERENCES_HEADING = 'הערות שוליים';
const START_FROM_ARTICLE = '';

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function extractTemplateFromSourceCell(sourceCell: string): string | null {
  const normalized = normalizeLineEndings(sourceCell).trim();
  const template = findTemplate(normalized, TEMPLATE_NAME, SOURCE_PAGE);
  if (!template) {
    return null;
  }

  if (template.trim() !== normalized) {
    return null;
  }

  const templateData = getTemplateArrayData(template, TEMPLATE_NAME, SOURCE_PAGE, false);
  return templateFromArrayData(templateData, TEMPLATE_NAME);
}

function getArticleTitleFromCell(cell: string): string | null {
  const links = getInnerLinks(cell);
  if (links[0]?.link) {
    return links[0].link.trim();
  }

  return null;
}

function extractUpdatesFromTables(tables: TableData[]): Map<string, string> {
  const articleToTemplate = new Map<string, string>();

  tables.slice(0, 2).forEach((table, tableIndex) => {
    table.rows.forEach((row, rowIndex) => {
      if (row.isHeader) {
        return;
      }

      if (row.fields.length < 5) {
        console.log(`Skipping row ${rowIndex + 1} in table ${tableIndex + 1}: less than 5 fields`);
        return;
      }

      const articleTitle = getArticleTitleFromCell(String(row.fields[1] ?? ''));
      const sourceText = String(row.fields[4] ?? '');
      const template = extractTemplateFromSourceCell(sourceText);

      if (!articleTitle || !template) {
        return;
      }

      if (!articleToTemplate.has(articleTitle)) {
        articleToTemplate.set(articleTitle, template);
      }
    });
  });

  return articleToTemplate;
}

function hasHachaiVehatzomeachTemplate(text: string): boolean {
  return findTemplate(text, TEMPLATE_NAME, 'external-links-section') !== '';
}

function getInsertionAnchorIndex(articleText: string): number | null {
  const explanationsHeadingRegex = new RegExp(`^\\s*==\\s*${EXPLANATIONS_HEADING}\\s*==\\s*$`, 'm');
  const referencesHeadingRegex = new RegExp(`^\\s*==\\s*${REFERENCES_HEADING}\\s*==\\s*$`, 'm');
  const categoriesRegex = /^\s*\[\[\s*קטגוריה\s*:/m;

  const explanationsMatch = articleText.match(explanationsHeadingRegex);
  const referencesMatch = articleText.match(referencesHeadingRegex);
  const categoriesMatch = articleText.match(categoriesRegex);
  const authorityControlTemplate = findTemplate(articleText, AUTHORITY_CONTROL_TEMPLATE, 'article');
  const authorityControlIndex = authorityControlTemplate
    ? articleText.indexOf(authorityControlTemplate)
    : -1;
  const stubTemplate = findTemplate(articleText, STUB_TEMPLATE, 'article');
  const stubIndex = stubTemplate
    ? articleText.indexOf(stubTemplate)
    : -1;

  const candidateIndexes = [
    explanationsMatch?.index,
    referencesMatch?.index,
    categoriesMatch?.index,
    authorityControlIndex > -1 ? authorityControlIndex : undefined,
    stubIndex > -1 ? stubIndex : undefined,
  ]
    .filter((index): index is number => index != null)
    .sort((a, b) => a - b);

  return candidateIndexes.length > 0 ? candidateIndexes[0] : null;
}

function insertExternalLinksSection(articleText: string, template: string): string {
  const insertBlock = `\n== ${EXTERNAL_LINKS_HEADING} ==\n* ${template}\n`;
  const insertIndex = getInsertionAnchorIndex(articleText);
  if (insertIndex != null) {
    const before = articleText.slice(0, insertIndex).replace(/\s*$/, '\n');
    const after = articleText.slice(insertIndex).replace(/^\s*/, '');
    return `${before}${insertBlock}\n${after}`;
  }

  return `${articleText.replace(/\s*$/, '')}${insertBlock}`;
}

function addTemplateToExternalLinksSection(articleText: string, template: string, title: string): string {
  const sectionWithTitle = getParagraphContent(articleText, EXTERNAL_LINKS_HEADING, title, true);
  if (!sectionWithTitle) {
    return insertExternalLinksSection(articleText, template);
  }

  if (hasHachaiVehatzomeachTemplate(sectionWithTitle)) {
    return articleText;
  }

  const templateLine = `* ${template}\n`;
  const authorityControlInSection = findTemplate(sectionWithTitle, AUTHORITY_CONTROL_TEMPLATE, title);
  const authorityControlIndex = authorityControlInSection
    ? sectionWithTitle.indexOf(authorityControlInSection)
    : -1;
  const categoriesMatch = sectionWithTitle.match(/^\s*\[\[\s*קטגוריה\s*:/m);
  const insertIndexCandidates = [
    authorityControlIndex > -1 ? authorityControlIndex : undefined,
    categoriesMatch?.index,
  ].filter((index): index is number => index != null).sort((a, b) => a - b);

  const updatedSection = insertIndexCandidates.length > 0
    ? `${sectionWithTitle.slice(0, insertIndexCandidates[0]).replace(/\s*$/, '\n')}${templateLine}${sectionWithTitle.slice(insertIndexCandidates[0]).replace(/^\s*/, '')}`
    : `${sectionWithTitle.replace(/\s*$/, '')}\n${templateLine}`;
  return articleText.replace(sectionWithTitle, updatedSection);
}

type UpdateResult = 'updated' | 'skipped' | 'failed';

async function resolveRedirectTarget(
  api: IWikiApi,
  initialTitle: string,
): Promise<{ title: string; content: string; revid: number }> {
  const current = await api.articleContent(initialTitle);
  const redirectTarget = getRedirectTargetFromContent(current.content);
  if (!redirectTarget) {
    return {
      title: initialTitle,
      content: current.content,
      revid: current.revid,
    };
  }

  const redirected = await api.articleContent(redirectTarget);
  return {
    title: redirectTarget,
    content: redirected.content,
    revid: redirected.revid,
  };
}

async function updateArticleIfNeeded(
  api: ReturnType<typeof WikiApi>,
  title: string,
  template: string,
): Promise<UpdateResult> {
  try {
    const resolved = await resolveRedirectTarget(api, title);
    const newContent = addTemplateToExternalLinksSection(resolved.content, template, resolved.title);

    if (newContent === resolved.content) {
      console.log(`Skipping ${resolved.title}: template already exists in ${EXTERNAL_LINKS_HEADING}`);
      return 'skipped';
    }

    await api.edit(
      resolved.title,
      `הוספת [[תבנית:${TEMPLATE_NAME}]] לפרק ${EXTERNAL_LINKS_HEADING}`,
      newContent,
      resolved.revid,
    );

    if (resolved.title !== title) {
      console.log(`Updated ${resolved.title} (redirect from ${title})`);
    } else {
      console.log(`Updated ${title}`);
    }
    return 'updated';
  } catch (error) {
    console.error(`Failed to process ${title}:`, error.message || error.toString());
    return 'failed';
  }
}

export default async function addHachaiVehatzomeachExternalLinks() {
  const api = WikiApi();
  await api.login();

  console.log(`Loading source page: ${SOURCE_PAGE}`);
  const { content: sourceContent } = await api.articleContent(SOURCE_PAGE);
  const tables = parseTableText(sourceContent);

  if (tables.length < 2) {
    throw new Error(`Expected at least 2 tables in ${SOURCE_PAGE}, found ${tables.length}`);
  }

  const updates = extractUpdatesFromTables(tables);
  console.log(`Found ${updates.size} candidate articles from first two tables`);

  let updatedCount = 0;
  let skippedExistingCount = 0;
  let failedCount = 0;
  let skippedBeforeStartCount = 0;
  let shouldProcess = !START_FROM_ARTICLE;

  for (const [title, template] of updates.entries()) {
    if (!shouldProcess && title === START_FROM_ARTICLE) {
      shouldProcess = true;
      console.log(`Reached start article (${START_FROM_ARTICLE}), beginning updates`);
    }

    if (shouldProcess) {
      const result = await updateArticleIfNeeded(api, title, template);
      if (result === 'updated') {
        updatedCount += 1;
      } else if (result === 'skipped') {
        skippedExistingCount += 1;
      } else {
        failedCount += 1;
      }
    } else {
      skippedBeforeStartCount += 1;
    }
  }

  if (!shouldProcess) {
    console.warn(`Start article not found among candidates: ${START_FROM_ARTICLE}`);
  }

  console.log('Done', {
    candidates: updates.size,
    startFromArticle: START_FROM_ARTICLE,
    skippedBeforeStartCount,
    updatedCount,
    skippedExistingCount,
    failedCount,
  });
}
