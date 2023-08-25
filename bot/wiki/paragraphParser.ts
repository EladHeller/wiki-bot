import { nextWikiText } from './WikiParser';
import { getInnerLinks } from './wikiLinkParser';

export function getParagraphContent(
  articleText: string,
  paragraphName: string,
  title?: string,
): string | null {
  let paragraphStartText = `==${paragraphName}==`;
  let startIndex = articleText.indexOf(paragraphStartText);
  if (startIndex === -1) {
    paragraphStartText = `== ${paragraphName} ==`;
    startIndex = articleText.indexOf(paragraphStartText);
    if (startIndex === -1) {
      return null;
    }
  }
  let endIndex = nextWikiText(articleText, startIndex + paragraphStartText.length, '==', false, title);
  if (endIndex === -1) {
    endIndex = articleText.length;
  }
  const content = articleText.substring(startIndex + paragraphStartText.length, endIndex);
  return content.replace(/^=*\n*/, '').replace(/\n*$/, '').trim();
}

export function getUsersFromTagParagraph(articleContent: string, paragraphName: string) : string[] {
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
  return users;
}
