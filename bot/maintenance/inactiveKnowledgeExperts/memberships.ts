import { contentFromPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';
import { findStructureAtIndex, parseWikiStructures } from '../../wiki/WikiParser';

export const TOPIC_PREFIX = 'תבנית:בעלי ידע/';
const TOPIC_CATEGORY = /\[\[\s*קטגוריה:\s*ויקיפדיה:\s*בעלי ידע\s+ב/u;
const NON_TRANSCLUDED = new RegExp(
  '<!--[\\s\\S]*?(?:-->|$)'
    + '|<(noinclude|nowiki|pre|syntaxhighlight|ref)\\b[^>]*?(?:/\\s*>|>[\\s\\S]*?(?:</\\1\\s*>|$))',
  'giu',
);

type Entry = { username: string; start: number; end: number; wholeEntry: boolean };

function usernameOf(name: string): string {
  const normalized = name.replace(/[_\s]+/g, ' ').trim().normalize();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function makeEntry(name: string, start: number, end: number, wholeEntry = true): Entry[] {
  const username = usernameOf(name);
  return username && !/[{}[\]<>/|#=:]/.test(username)
    ? [{
      username, start, end, wholeEntry,
    }]
    : [];
}

export function parseMembers(content: string): Entry[] {
  const body = content.replace(NON_TRANSCLUDED, (part) => part.replace(/[^\r\n]/g, ' '));
  const structures = parseWikiStructures(body);
  return structures.flatMap(({ type, start, end }) => {
    if (type !== 'wikilink' && type !== 'template') return [];
    const parent = findStructureAtIndex(structures, start);
    if (parent && !/^\{\{\s*#(?:שווה|ifeq)\s*:/iu.test(body.slice(parent.start, parent.end))) return [];

    const source = body.slice(start + 2, end - 2);
    if (type === 'wikilink') {
      const link = /^\s*:?(?:משתמשת?|מש|User)\s*:\s*([^|]+)(?:\||$)/iu.exec(source);
      return link ? makeEntry(link[1], start, end) : [];
    }

    const member = /^\s*(?:תבנית:\s*)?א\s*\|\s*(?:1\s*=\s*)?([^|]+)(?:\||$)/u.exec(source);
    if (member) return makeEntry(member[1], start, end);
    if (!/^\s*@@\s*\|[^{}[\]]+$/u.test(source)) return [];
    const args = [...source.matchAll(/\|([^|]*)/g)];
    if (args.some((arg) => arg[1].includes('='))) return [];
    if (args.length === 1) return makeEntry(args[0][1], start, end);
    return args.flatMap((arg) => {
      const offset = start + 2 + arg.index;
      return makeEntry(arg[1], offset, offset + arg[0].length, false);
    });
  });
}

export function withoutMember(content: string, username: string): string | undefined {
  const matches = parseMembers(content).filter((entry) => entry.username === username);
  if (matches.length > 1) throw new Error(`Ambiguous membership for ${username}`);
  if (matches.length === 0) return undefined;
  const { start, end, wholeEntry } = matches[0];
  const before = content.slice(0, start);
  const after = content.slice(end);
  if (!wholeEntry) return before + after;

  const tail = after.replace(/^[ \t]+\([^(){}[\]<>|\r\n]*\)/, '');
  const left = before.replace(/[ \t]+ו־?$/, '');
  if (/,([ \t]*)$/.test(left)) return left.replace(/,[ \t]*$/, '') + tail;
  return left + tail.replace(/^[ \t]*,[ \t]*/, '');
}

export function isTopic(content: string): boolean {
  return TOPIC_CATEGORY.test(content.replace(/<!--[\s\S]*?(?:-->|$)/g, ''));
}

export async function listKnowledgeExperts(api: IWikiApi): Promise<Map<string, string[]>> {
  const topicsByUser = new Map<string, string[]>();
  for await (const pages of api.allPages(10, '', 'בעלי ידע/')) {
    for (const page of pages) {
      const { content } = contentFromPage(page);
      if (content === undefined) throw new Error(`Missing template content: ${page.title}`);
      if (isTopic(content)) {
        const members = new Set(parseMembers(content).map(({ username }) => username));
        members.forEach((username) => {
          const topics = topicsByUser.get(username) ?? [];
          topicsByUser.set(username, [...topics, page.title]);
        });
      }
    }
  }
  return topicsByUser;
}
