import fs from 'fs/promises';
import osimhistoriaLinks from './osimhistoria.json';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const SOURCE_FILE = 'bot/scripts/oneTime/osimHistoria.ts';
const SUMMARY = 'הסבת קישורי עושים היסטוריה לתבנית {{עושים היסטוריה1}}';
const HOST_NAME = 'רן לוי';
const DRY_RUN = false;

type PageLink = {
  page: string;
  link: string;
};

function normalizeText(value: string): string {
  return value.trim()
    .replace(/^https?:\/\/(www\.)?osimhistoria\.com\//, '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '');
}

function extractPodcastSlug(url: string): string | null {
  const normalized = normalizeText(url);
  if (!normalized.startsWith('podcast/')) {
    return null;
  }
  return normalized.replace(/^podcast\//, '') || null;
}

function getNumericEpisode(value: string): number | null {
  const threeDigits = value.match(/^\D*(\d{3})\D/);
  if (threeDigits) return Number(threeDigits[1]);
  const fromOhEp = value.match(/oh_ep_(\d+)/i);
  if (fromOhEp) return Number(fromOhEp[1]);
  const fromEp = value.match(/(?:^|[-_/])ep(?:isode)?[_-]?(\d+)/i);
  if (fromEp) return Number(fromEp[1]);
  const fromPrefix = value.match(/^(\d+)[-_/]/);
  if (fromPrefix) return Number(fromPrefix[1]);
  return null;
}

function buildEpisodeMaps(links: string[]) {
  const byNumber = new Map<number, string>();
  const bySlug = new Map<string, string>();
  links.forEach((url) => {
    const slug = extractPodcastSlug(url);
    if (!slug) return;
    bySlug.set(slug, slug);
    const numeric = getNumericEpisode(slug);
    if (numeric && !byNumber.has(numeric)) byNumber.set(numeric, slug);
  });
  return { byNumber, bySlug };
}

function resolveTemplateEpisodeId(
  link: string,
  byNumber: Map<number, string>,
  bySlug: Map<string, string>,
): string | null {
  const normalized = normalizeText(link).replace(/^osimhistoria\/?/i, '');
  const numeric = getNumericEpisode(normalized);
  if (numeric) {
    const slug = byNumber.get(numeric);
    if (slug) return slug.match(/^\d{3}-/) ? String(numeric) : slug;
  }
  const rawSlug = normalized.replace(/^podcast\//, '');
  if (bySlug.has(rawSlug)) {
    const slugNumeric = getNumericEpisode(rawSlug);
    if (slugNumeric && rawSlug.match(/^\d+/)) return String(slugNumeric);
    return rawSlug;
  }
  return null;
}

function extractEntries(sourceText: string): PageLink[] {
  const entries: PageLink[] = [];
  const pattern = /\{\s*link:\s*'([^']+)',\s*page:\s*'([^']+)'\s*\}/g;
  let match = pattern.exec(sourceText);
  while (match) {
    const link = match[1];
    const page = match[2];
    if (link.startsWith('https://www.osimhistoria.com/osimhistoria/')) {
      entries.push({ page, link });
    }
    match = pattern.exec(sourceText);
  }
  return entries;
}

function replaceStrictMatches(content: string, link: string, episodeId: string) {
  const escapedLink = RegExp.escape(link);
  const toTemplate = (title: string) => `{{עושים היסטוריה1|${HOST_NAME}|${title.trim()}|${episodeId}}}`;

  let replaced = 0;
  let newContent = content;

  const externalLine = new RegExp(`(^[ \\t]*\\*[ \\t]*\\[${escapedLink}\\s+([^\\]]+)\\][ \\t]*$)`, 'gm');
  newContent = newContent.replace(externalLine, (_m, _line, title) => {
    replaced += 1;
    return `* ${toTemplate(title)}`;
  });

  const fullRefTag = new RegExp(`<ref>\\s*\\[${escapedLink}\\s+([^\\]]+)\\]\\s*<\\/ref>`, 'g');
  newContent = newContent.replace(fullRefTag, (_m, title) => {
    replaced += 1;
    return `<ref>${toTemplate(title)}</ref>`;
  });

  const fullComment = new RegExp(`{{הערה\\|\\s*\\[${escapedLink}\\s+([^\\]]+)\\]\\s*}}`, 'g');
  newContent = newContent.replace(fullComment, (_m, title) => {
    replaced += 1;
    return `{{הערה|${toTemplate(title)}}}`;
  });

  return { newContent, replaced };
}

async function processPage(
  api: IWikiApi,
  page: string,
  linksInPage: Set<string>,
  byNumber: Map<number, string>,
  bySlug: Map<string, string>,
) {
  let article;
  try {
    article = await api.articleContent(page);
  } catch (e) {
    console.log(`Failed to fetch ${page}`, e?.message || e?.toString?.());
    return;
  }

  let newContent = article.content;
  let totalReplaced = 0;

  linksInPage.forEach((link) => {
    const episodeId = resolveTemplateEpisodeId(link, byNumber, bySlug);
    if (!episodeId) {
      console.log(`No episode mapping for ${link} in ${page}`);
      return;
    }
    const replacement = replaceStrictMatches(newContent, link, episodeId);
    newContent = replacement.newContent;
    totalReplaced += replacement.replaced;
  });

  if (newContent === article.content) return;
  if (DRY_RUN) {
    console.log(`DRY-RUN ${page}: replaced ${totalReplaced} links`);
    return;
  }
  await api.edit(page, SUMMARY, newContent, article.revid);
  console.log(`Updated ${page}: replaced ${totalReplaced} links`);
}

export default async function osimHistoriaLinksToTemplate() {
  const sourceText = await fs.readFile(SOURCE_FILE, 'utf8');
  const entries = extractEntries(sourceText);
  const links = osimhistoriaLinks as string[];
  const { byNumber, bySlug } = buildEpisodeMaps(links);

  const pageToLinks = new Map<string, Set<string>>();
  entries.forEach(({ page, link }) => {
    if (!pageToLinks.has(page)) pageToLinks.set(page, new Set<string>());
    pageToLinks.get(page)?.add(link);
  });

  console.log(`Collected ${entries.length} links, ${pageToLinks.size} unique pages`);
  const api = WikiApi();
  await api.login();

  for (const [page, linksInPage] of pageToLinks.entries()) {
    await processPage(api, page, linksInPage, byNumber, bySlug);
  }
}
