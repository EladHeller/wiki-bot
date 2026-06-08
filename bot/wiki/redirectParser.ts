import { getInnerLink } from './wikiLinkParser';

const REDIRECT_ONLY_REGEX = /^\s*#\S+\s*\[\[[^\]]+\]\]$/i;
const REDIRECT_START_REGEX = /^\s*#\S+\s*\[\[[^\]]+\]\]/i;

export function getRedirectTargetFromContent(content: string, redirectOnly = true): string | null {
  const normalized = content.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const firstNonEmptyLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstNonEmptyLine) {
    return null;
  }
  const regex = redirectOnly ? REDIRECT_ONLY_REGEX : REDIRECT_START_REGEX;
  if (!firstNonEmptyLine.match(regex)) {
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
