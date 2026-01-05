import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import { getInnerLinks } from '../../wiki/wikiLinkParser';
import { findTemplates } from '../../wiki/newTemplateParser';

const TEMPLATE_NAME = 'נעמי שמר';
const EDIT_SUMMARY = 'הוספת תבנית:נעמי שמר ([[מיוחד:הבדל/42487828|בקשה בוק:בב]])';

async function getArticleTitlesFromTemplate(api: IWikiApi): Promise<string[]> {
  const { content } = await api.articleContent(`תבנית:${TEMPLATE_NAME}`);
  const links = getInnerLinks(content);
  const articleTitles: string[] = [];

  for (let i = 0; i < links.length; i += 1) {
    const { link } = links[i];
    if (!link.startsWith('קטגוריה:') && !link.startsWith('תבנית:') && !link.startsWith('קובץ:')) {
      articleTitles.push(link);
    }
  }

  const uniqueTitles = [...new Set(articleTitles)];
  console.log(`Found ${uniqueTitles.length} unique articles in template (${articleTitles.length} total links)`);

  return uniqueTitles;
}

function isNavigationTemplateLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\{\{[^}]+\}\}$/.test(trimmed);
}

function isFootnotesTemplate(line: string): boolean {
  const trimmed = line.trim();
  return /^\{\{הערות שוליים[|}]/i.test(trimmed);
}

function isAuthorityControlTemplate(line: string): boolean {
  const trimmed = line.trim();
  return /^\{\{בקרת זהויות[|}]/i.test(trimmed);
}

function isCategoryLine(line: string): boolean {
  return /\[\[קטגוריה:/i.test(line);
}

function findTemplatePosition(content: string, title: string): number {
  const templates = findTemplates(content, TEMPLATE_NAME, title);
  if (templates.length === 0) {
    return -1;
  }
  return content.indexOf(templates[0]);
}

function removeSpaceAfterTemplate(content: string, title: string): string {
  const templatePos = findTemplatePosition(content, title);
  if (templatePos === -1) {
    return content;
  }

  const lines = content.split('\n');
  let currentPos = 0;
  let templateLineIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const lineEndPos = currentPos + lines[i].length;
    if (templatePos >= currentPos && templatePos < lineEndPos) {
      templateLineIndex = i;
      break;
    }
    currentPos = lineEndPos + 1;
  }

  if (templateLineIndex === -1 || templateLineIndex >= lines.length - 1) {
    return content;
  }

  const nextLineIndex = templateLineIndex + 1;
  if (nextLineIndex < lines.length && lines[nextLineIndex].trim() === '') {
    const lineAfterEmpty = nextLineIndex + 1;
    if (lineAfterEmpty < lines.length) {
      const lineAfterEmptyContent = lines[lineAfterEmpty];
      if (isNavigationTemplateLine(lineAfterEmptyContent) && !isAuthorityControlTemplate(lineAfterEmptyContent)) {
        lines.splice(nextLineIndex, 1);
        return lines.join('\n');
      }
    }
  }

  return content;
}

function findInsertionPoint(content: string): number {
  const lines = content.split('\n');

  let firstCategoryIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isCategoryLine(lines[i])) {
      firstCategoryIndex = i;
      break;
    }
  }

  if (firstCategoryIndex === -1) {
    return lines.length;
  }

  let insertionIndex = firstCategoryIndex;

  for (let i = firstCategoryIndex - 1; i >= 0; i -= 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed !== '') {
      if (isFootnotesTemplate(line)) {
        insertionIndex = i + 1;
        break;
      } else if (isNavigationTemplateLine(line)) {
        insertionIndex = i;
      } else {
        insertionIndex = i + 1;
        break;
      }
    }
  }

  return insertionIndex;
}

function insertTemplate(content: string): string {
  const lines = content.split('\n');
  const insertionIndex = findInsertionPoint(content);

  const templateLine = `{{${TEMPLATE_NAME}}}`;

  const prevLine = insertionIndex > 0 ? lines[insertionIndex - 1] : '';
  const nextLine = insertionIndex < lines.length ? lines[insertionIndex] : '';

  const isPrevLineEmpty = prevLine.trim() === '';
  const isNextLineNavTemplate = isNavigationTemplateLine(nextLine);
  const isNextLineCategory = isCategoryLine(nextLine);

  const needsLineAbove = insertionIndex > 0 && !isPrevLineEmpty && !isNextLineNavTemplate;
  const needsLineBelow = nextLine.trim() !== '' && isNextLineCategory;

  const linesToInsert: string[] = [];
  if (needsLineAbove) {
    linesToInsert.push('');
  }
  linesToInsert.push(templateLine);
  if (needsLineBelow) {
    linesToInsert.push('');
  }

  lines.splice(insertionIndex, 0, ...linesToInsert);

  return lines.join('\n');
}

async function processArticle(
  api: IWikiApi,
  title: string,
): Promise<void> {
  try {
    const { content, revid } = await api.articleContent(title);

    const templatePos = findTemplatePosition(content, title);

    if (templatePos !== -1) {
      const newContent = removeSpaceAfterTemplate(content, title);
      if (newContent !== content) {
        await api.edit(title, 'הסרת רווח מיותר אחרי תבנית:נעמי שמר', newContent, revid);
        console.log(`Removed space after template in ${title}`);
      } else {
        console.log(`Skipping ${title} - template already exists and no space to remove`);
      }
      return;
    }

    const newContent = insertTemplate(content);

    await api.edit(title, EDIT_SUMMARY, newContent, revid);
    console.log(`Updated ${title}`);
  } catch (error) {
    console.error(`Error processing ${title}:`, error?.message || error);
  }
}

export default async function NaomiShemerTemplate() {
  const api = WikiApi();
  await api.login();

  console.log('Fetching article titles from template...');
  const articleTitles = await getArticleTitlesFromTemplate(api);

  console.log(`Processing ${articleTitles.length} articles...`);

  for (const title of articleTitles) {
    try {
      await processArticle(api, title);
    } catch (error) {
      console.error(`Error processing ${title}:`, error?.message || error);
    }
  }

  console.log('Done!');
}
