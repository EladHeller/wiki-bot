import { findStructureAtIndex, nextWikiText, parseWikiStructures } from './WikiParser';
import { findTemplates } from './newTemplateParser';
import { getInnerLinks } from './wikiLinkParser';

export interface Paragraph {
  name: string;
  content: string;
}

export function getParagraphEnd(articleText: string, startIndex: number, title?: string, level = 2): number {
  const structures = parseWikiStructures(articleText, startIndex, title);
  let index = startIndex;
  while (index < articleText.length) {
    const insideStructure = findStructureAtIndex(structures, index, false);
    if (insideStructure) {
      index = insideStructure.end;
    } else if (articleText[index] === '=') {
      const idx = index;
      let count = 0;
      while (idx + count < articleText.length && articleText[idx + count] === '=') {
        count += 1;
      }

      let isStartOfLine = true;
      for (let j = idx - 1; j >= 0; j -= 1) {
        const char = articleText[j];
        if (char === '\n') {
          break;
        }
        if (char !== ' ' && char !== '\t') {
          isStartOfLine = false;
          break;
        }
      }

      let advanced = false;
      if (isStartOfLine) {
        if (count <= level) {
          return idx;
        }
        const lineEnd = articleText.indexOf('\n', idx);
        index = lineEnd === -1 ? articleText.length : lineEnd;
        advanced = true;
      }

      if (!advanced) {
        index += count;
      }
    } else {
      index += 1;
    }
  }

  return articleText.length;
}
export function getParagraphContent(
  articleText: string,
  paragraphName: string,
  title?: string,
  withTitle = false,
): string | null {
  const headingRegex = new RegExp(`^[ \\t]*==[ \\t]*${RegExp.escape(paragraphName)}[ \\t]*==[ \\t]*$`, 'm');
  const match = articleText.match(headingRegex);
  if (!match || match.index == null) return null;

  const startIndex = match.index;
  const paragraphStartText = match[0];

  const endIndex = getParagraphEnd(articleText, startIndex + paragraphStartText.length, title);

  if (withTitle) {
    return articleText.substring(startIndex, endIndex);
  }
  const content = articleText.substring(startIndex + paragraphStartText.length, endIndex);
  return content.replace(/\n*$/, '').trim();
}

export function parseParagraph(paragraphText: string): Paragraph {
  const titleMatch = paragraphText.match(/^[ \t]*={2,4}[ \t]*([^=]+?)[ \t]*={2,4}[ \t]*$/m);
  if (!titleMatch || titleMatch.index == null) {
    throw new Error('Invalid paragraph format: missing title');
  }

  const name = titleMatch[1].trim();
  const startIndex = titleMatch.index + titleMatch[0].length;
  const content = paragraphText.substring(startIndex).trim();

  return { name, content };
}

export function getAllParagraphs(articleText: string, articleTitle: string, level = 2): string[] {
  let currIndex = 0;
  const levelText = '='.repeat(level);
  const paragraphContents: string[] = [];
  while (currIndex !== -1) {
    const start = nextWikiText(articleText, currIndex, levelText, false);
    if (start === -1) {
      break;
    }
    if (articleText.substring(start, start + level + 1) === `${levelText}=`) {
      currIndex = start + level + 1;
    } else {
      const nextNewLine = articleText.indexOf('\n', start);
      const titleStart = start + level;

      const titleEnd = nextWikiText(articleText, titleStart, levelText, false);
      if (titleEnd === -1) {
        currIndex = titleStart;
      } else if (nextNewLine !== -1 && nextNewLine < titleEnd) {
        currIndex = nextNewLine;
      } else {
        const paragraphEnd = getParagraphEnd(articleText, titleEnd + level, articleTitle, level);
        paragraphContents.push(articleText.substring(start, paragraphEnd));
        currIndex = paragraphEnd;
      }
    }
  }

  return paragraphContents.filter((x) => x); // TODO: check if it's neccessary
}

export function getUsersFromTagParagraph(articleContent: string, paragraphName: string): string[] {
  const tagParagraph = getParagraphContent(articleContent, paragraphName);
  const users: string[] = [];
  if (!tagParagraph) {
    return users;
  }
  getInnerLinks(tagParagraph).forEach(({ link, text }) => {
    if (!link?.match('^(משתמשת?:|user:)')) {
      return;
    }
    if (link === text || !text) {
      users.push(`[[${link}]]`);
    } else {
      users.push(`[[${link}|${text}]]`);
    }
  });
  users.push(...findTemplates(tagParagraph, 'א', paragraphName));
  return users;
}
