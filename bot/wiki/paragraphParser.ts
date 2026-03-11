import { escapeRegex } from '../utilities';
import { nextWikiText } from './WikiParser';
import { findTemplates } from './newTemplateParser';
import { getInnerLinks } from './wikiLinkParser';

export interface Paragraph {
  name: string;
  content: string;
}

export function getParagraphEnd(articleText: string, startIndex: number, title?: string): number {
  let endIndex = nextWikiText(articleText, startIndex, '==', false, title);
  while (endIndex !== -1 && articleText.substring(endIndex, endIndex + 3) === '===') {
    let nextIndex = endIndex;
    while (articleText[nextIndex] === '=') {
      nextIndex += 1;
    }
    endIndex = nextWikiText(articleText, nextIndex, '==', false, title);
  }
  if (endIndex === -1) {
    endIndex = articleText.length;
  }
  return endIndex;
}

export function getParagraphContent(
  articleText: string,
  paragraphName: string,
  title?: string,
  withTitle = false,
): string | null {
  const headingRegex = new RegExp(`^[ \\t]*==[ \\t]*${escapeRegex(paragraphName)}[ \\t]*==[ \\t]*$`, 'm');
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

export function getAllParagraphs(articleText: string, articleTitle: string): string[] {
  let currIndex = 0;
  const paragraphContents: string[] = [];
  while (currIndex !== -1) {
    const start = nextWikiText(articleText, currIndex, '==', false);
    if (start === -1) {
      break;
    }
    if (articleText.substring(start, start + 3) === '===') {
      currIndex = start + 3;
    } else {
      const nextNewLine = articleText.indexOf('\n', start);
      const titleStart = start + 2;

      const titleEnd = nextWikiText(articleText, titleStart, '==', false);
      if (titleEnd === -1) {
        currIndex = titleStart;
      } else if (nextNewLine !== -1 && nextNewLine < titleEnd) {
        currIndex = nextNewLine;
      } else {
        const paragraphEnd = getParagraphEnd(articleText, titleEnd + 2, articleTitle);
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
