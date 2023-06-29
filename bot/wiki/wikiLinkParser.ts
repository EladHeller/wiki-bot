import { nextWikiText } from './WikiParser';

type InnerLink = {
  link: string;
  text: string;
}

export function getInnerLinks(text: string): InnerLink[] {
  const links: InnerLink[] = [];
  let currIndex = 0;
  let nextLinkIndex = nextWikiText(text, currIndex, '[[');
  while (nextLinkIndex !== -1 && currIndex < text.length) {
    const endLinkIndex = nextWikiText(text, nextLinkIndex + 2, ']]');
    if (endLinkIndex === -1) {
      break;
    }
    const link = text.substring(nextLinkIndex + 2, endLinkIndex);
    const linkParts = link.split('|');
    links.push({ link: linkParts[0], text: linkParts[1] ?? linkParts[0] });
    currIndex = endLinkIndex + 2;
    nextLinkIndex = nextWikiText(text, currIndex, '[[');
  }

  return links;
}

export function getInnerLink(text: string): InnerLink | undefined {
  const [link] = getInnerLinks(text);
  return link;
}