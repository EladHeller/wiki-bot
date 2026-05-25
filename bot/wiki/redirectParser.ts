import { getInnerLink } from './wikiLinkParser';

export function getRedirectTargetFromContent(content: string): string | null {
  const normalized = content.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const firstNonEmptyLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) {
    return null;
  }

  if (!firstNonEmptyLine.match(/^#(?:redirect|הפניה)(?:\s|$)/i)) {
    return null;
  }

  const redirectLink = getInnerLink(firstNonEmptyLine);
  if (!redirectLink?.link) {
    return null;
  }

  return redirectLink.link.trim();
}

export function isRedirectContent(content: string): boolean {
  return getRedirectTargetFromContent(content) != null;
}
