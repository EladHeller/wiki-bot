import { parseWikiStructures } from './WikiParser';

export type WikiLink = {
  link: string;
  text: string;
  params?: string[];
}

export function getInnerLinks(text: string): WikiLink[] {
  const structures = parseWikiStructures(text);
  const wikilinks = structures.filter((s) => s.type === 'wikilink');

  return wikilinks.map((structure) => {
    const linkContent = text.substring(structure.start + 2, structure.end - 2);
    const linkParts = linkContent.split('|');
    const innerLink = linkParts[0].startsWith(':') ? linkParts[0].substring(1) : linkParts[0];
    const currentLink: WikiLink = { link: innerLink, text: linkParts[1] ?? innerLink };
    if (linkParts.length > 2) {
      currentLink.params = linkParts.slice(1);
    }
    return currentLink;
  });
}

export function getInnerLink(text: string): WikiLink | undefined {
  const [link] = getInnerLinks(text);
  return link;
}

export function getExternalLinks(text: string): WikiLink[] {
  const structures = parseWikiStructures(text);
  const externalLinks = structures.filter((s) => s.type === 'link');

  return externalLinks.map((structure) => {
    const linkText = text.substring(structure.start + 1, structure.end - 1).trim();
    const [link, ...description] = linkText.split(' ');
    return { link, text: description.join(' ') };
  });
}

export function getExternalLink(text: string): WikiLink | undefined {
  const [link] = getExternalLinks(text);
  return link;
}
