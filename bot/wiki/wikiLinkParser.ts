import { nextWikiText } from './WikiParser';

export type WikiLink = {
  link: string;
  text: string;
}

export function getInnerLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  let currIndex = 0;
  let nextLinkIndex = nextWikiText(text, currIndex, '[[', true);
  while (nextLinkIndex !== -1 && currIndex < text.length) {
    const endLinkIndex = nextWikiText(text, nextLinkIndex + 2, ']]', true);
    if (endLinkIndex === -1) {
      return links;
    }
    const link = text.substring(nextLinkIndex + 2, endLinkIndex);
    const linkParts = link.split('|');
    const innerLink = linkParts[0].startsWith(':') ? linkParts[0].substring(1) : linkParts[0];
    links.push({ link: innerLink, text: linkParts[1] ?? innerLink });
    currIndex = endLinkIndex + 2;
    nextLinkIndex = nextWikiText(text, currIndex, '[[', true);
  }

  return links;
}

export function getInnerLink(text: string): WikiLink | undefined {
  const [link] = getInnerLinks(text);
  return link;
}

export function getExteranlLinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  let currIndex = 0;
  let nextLinkIndex = nextWikiText(text, currIndex, '[', true);
  while (nextLinkIndex !== -1 && currIndex < text.length) {
    if (text[nextLinkIndex + 1] === '[') {
      currIndex = nextLinkIndex + 2;
    } else {
      const endLinkIndex = nextWikiText(text, nextLinkIndex + 1, ']', true);
      if (endLinkIndex === -1) {
        return links;
      }
      const linkText = text.substring(nextLinkIndex + 1, endLinkIndex).trim();
      const [link, ...description] = linkText.split(' ');
      links.push({ link, text: description.join(' ') });

      currIndex = endLinkIndex + 1;
    }

    nextLinkIndex = nextWikiText(text, currIndex, '[', true);
  }

  return links;
}

export function getExteranlLink(text: string): WikiLink | undefined {
  const [link] = getExteranlLinks(text);
  return link;
}
