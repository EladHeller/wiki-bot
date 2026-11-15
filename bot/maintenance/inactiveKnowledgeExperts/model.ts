import { WikiPage } from '../../types';
import { contentFromPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';

const PREFIX = 'תבנית:בעלי ידע/';
const WARNING_MARKER = 'Sapper-bot:knowledge-expert-warning:';
const CLOSED_MARKER = 'Sapper-bot:knowledge-expert-closed';
const DAY_MS = 24 * 60 * 60 * 1000;

type Membership = { username: string; title: string };
type Warning = { timestamp: Date; topics: string[]; marker: string };
type UserEntry = { username: string; start: number; end: number };

export type RunOptions = { now?: Date; dryRun?: boolean; maxUsers?: number };
export type RunReport = {
  dryRun: boolean;
  totalUsers: number;
  warned: string[];
  removed: string[];
  canceled: string[];
  skipped: string[];
};

const normalize = (value: string) => value.replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
const keyOf = (value: string) => normalize(value).toLocaleLowerCase('en');
const unique = (values: string[]) => [...new Set(values)];
const topicOf = (title: string) => title.slice(PREFIX.length);
const talkTitle = (username: string) => `שיחת משתמש:${username}`;
const wikiUserLink = /\[\[\s*(?:משתמש|משתמשת|User)\s*:\s*([^\]|#]+)(?:\|[^\]]*)?\]\]/;
const wikiUserTemplate = /\{\{\s*א\s*\|\s*([^|}]+)(?:\|[^}]*)?\}\}/;
const userPattern = new RegExp(`${wikiUserLink.source}|${wikiUserTemplate.source}`, 'giu');

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const monthOf = (date: Date) => dateOnly(date).toISOString().slice(0, 7);
const processedThisMonth = (content: string, now: Date) => (
  content.includes(`<!-- ${WARNING_MARKER}${monthOf(now)}-`)
  || content.includes(`<!-- ${CLOSED_MARKER}:${monthOf(now)} -->`)
);

function oneMonthLater(date: Date): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), days)));
}

export function parseMembers(content: string): UserEntry[] {
  const end = content.search(/<noinclude\b/i);
  const body = (end < 0 ? content : content.slice(0, end));
  const comments = [...body.matchAll(/<!--[\s\S]*?-->/g)]
    .map((match) => ({ start: (match.index as number), end: (match.index as number) + match[0].length }));
  return [...body.matchAll(userPattern)].filter((match) => (
    !comments.some((comment) => (match.index as number) >= comment.start && (match.index as number) < comment.end)
  )).map((match) => ({
    username: normalize(match[1] ?? match[2]),
    start: (match.index as number),
    end: (match.index as number) + match[0].length,
  }));
}

export function removeMember(content: string, username: string): string | null {
  const entries = parseMembers(content).filter((entry) => keyOf(entry.username) === keyOf(username));
  if (entries.length !== 1) return null;
  const { start, end } = entries[0];
  const before = content.slice(0, start);
  const after = content.slice(end);
  if (/,\s*$/.test(before)) return before.replace(/,\s*$/, '') + after;
  if (/^\s*,/.test(after)) return before + after.replace(/^\s*,\s*/, '');
  return before + after;
}

function sectionEnd(content: string, start: number): number {
  const remaining = content.slice(start);
  const next = remaining.search(/^==[^=\n].*==\s*$/m);
  return next < 0 ? content.length : start + next;
}

export function pendingWarning(content: string): Warning | null {
  const markers = [...content.matchAll(/<!-- Sapper-bot:knowledge-expert-warning:(\d{4}-\d{2}-\d{2}) -->/g)];
  const warnings = markers.reverse().map((match) => {
    const section = content.slice((match.index as number), sectionEnd(content, (match.index as number)));
    if (section.includes(CLOSED_MARKER)) return null;
    const topics = [...section.matchAll(/\[\[\s*תבנית:בעלי ידע\/([^\]|]+)(?:\|[^\]]*)?\]\]/g)]
      .map((topic) => normalize(topic[1]));
    return {
      timestamp: new Date(`${match[1]}T00:00:00Z`),
      topics: unique(topics),
      marker: match[0],
    };
  });
  return warnings.find((warning) => warning !== null) ?? null;
}

const topicLinks = (topics: string[]) => topics.map((topic) => `* [[תבנית:בעלי ידע/${topic}]]`).join('\n');

export function warningMessage(topics: string[], now: Date): string {
  return '\n\n== הודעה בנושא רשימות בעלי הידע ==\n'
    + `<!-- ${WARNING_MARKER}${dateOnly(now).toISOString().slice(0, 10)} -->\n`
    + `שלום, ותודה על נכונותך לשתף את הידע שלך עם עורכי ויקיפדיה בתחומים הבאים:\n${
      topicLinks(topics)}\n\n`
    + 'במסגרת תחזוקת רשימות בעלי הידע, נמצאה תקופה של יותר משלוש שנים ללא עריכות מחשבון זה '
    + 'בוויקיפדיה העברית. כדי שפניות יגיעו לעורכים זמינים, שמך צפוי להיות מוסר מהרשימות '
    + 'בעוד כחודש, אם לא תהיה פעילות נוספת בחשבון.\n\n'
    + 'אם ברצונך להישאר ברשימות, די בעריכה בוויקיפדיה העברית במהלך החודש הקרוב. '
    + 'גם לאחר הסרה אפשר להצטרף מחדש לרשימות בכל עת.\n\n'
    + 'תודה על תרומתך למיזם. [[משתמש:Sapper-bot|Sapper-bot]]\n';
}

export function closeWarning(content: string, warning: Warning, message: string, now: Date): string {
  const start = content.indexOf(warning.marker);
  if (start < 0) throw new Error('Warning marker was not found');
  const end = sectionEnd(content, start);
  return `${content.slice(0, end).trimEnd()
  }\n: ${message}\n<!-- ${CLOSED_MARKER}:${monthOf(now)} -->\n${content.slice(end)}`;
}

export function formerExpertTemplates(topics: string[]): string {
  return Array.from({ length: Math.ceil(topics.length / 10) }, (_, index) => (
    `{{בעל ידע לשעבר|${topics.slice(index * 10, (index + 1) * 10).join('|')}}}`
  )).join('\n');
}

export async function listKnowledgeExperts(api: IWikiApi): Promise<Membership[]> {
  const memberships: Membership[] = [];
  for await (const pages of api.allPages(10, 'בעלי ידע/')) {
    for (const page of pages) {
      if (!page.title.startsWith(PREFIX)) return memberships;
      const { content } = contentFromPage(page as WikiPage);
      if (content === undefined) throw new Error(`Missing template content: ${page.title}`);
      memberships.push(...parseMembers(content).map((entry) => ({
        title: page.title, username: entry.username,
      })));
    }
  }
  return memberships;
}

async function recentlyActive(api: IWikiApi, username: string, now: Date): Promise<boolean> {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(now.getUTCFullYear() - 3);
  for await (const revisions of api.userContributes(username, cutoff, now, 1)) {
    if (revisions.length > 0) return true;
  }
  return false;
}

async function readTalk(api: IWikiApi, username: string) {
  const title = talkTitle(username);
  const [info] = await api.info([title]);
  if (!info || info.missing !== undefined) {
    return {
      title, exists: false, content: '', revid: 0,
    };
  }
  const state = await api.articleContent(title);
  return { title, exists: true, ...state };
}

async function writeTalk(
  api: IWikiApi,
  talk: Awaited<ReturnType<typeof readTalk>>,
  content: string,
  summary: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  if (talk.exists) await api.edit(talk.title, summary, content, talk.revid);
  else await api.create(talk.title, summary, content);
}

async function removeFromTopics(api: IWikiApi, username: string, topics: string[], dryRun: boolean): Promise<string[]> {
  const removed: string[] = [];
  for (const topic of unique(topics)) {
    const title = PREFIX + topic;
    const [info] = await api.info([title]);
    const page = info && info.missing === undefined ? await api.articleContent(title) : null;
    if (page) {
      const entries = parseMembers(page.content).filter((entry) => keyOf(entry.username) === keyOf(username));
      if (entries.length > 0) {
        if (entries.length !== 1) throw new Error(`Ambiguous knowledge expert entry: ${title}: ${username}`);
        const content = removeMember(page.content, username) as string;
        if (!dryRun) await api.edit(title, 'הסרת בעל ידע לאחר התראה וחוסר פעילות', content, page.revid);
        removed.push(topic);
      }
    }
  }
  return removed;
}

export default async function runInactiveKnowledgeExperts(api: IWikiApi, options: RunOptions = {}): Promise<RunReport> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun !== false;
  const all = await listKnowledgeExperts(api);
  const byUser = new Map<string, { username: string; topics: string[] }>();
  all.forEach(({ username, title }) => {
    const key = keyOf(username);
    if (!byUser.has(key)) byUser.set(key, { username, topics: [] });
    (byUser.get(key) as { username: string; topics: string[] }).topics.push(topicOf(title));
  });
  const users = [...byUser.values()];
  const result: RunReport = {
    dryRun, totalUsers: users.length, warned: [], removed: [], canceled: [], skipped: [],
  };

  for (const { username, topics: rawTopics } of users.slice(0, options.maxUsers ?? users.length)) {
    const topics = unique(rawTopics);
    const talk = await readTalk(api, username);
    const processed = processedThisMonth(talk.content, now);
    const active = processed || await recentlyActive(api, username, now);
    const warning = processed ? null : pendingWarning(talk.content);
    if (processed) result.skipped.push(username);
    else if (active) {
      if (warning) {
        await writeTalk(
          api,
          talk,
          closeWarning(talk.content, warning, 'ההסרה בוטלה בעקבות חזרה לפעילות. תודה!', now),
          'ביטול הסרה מרשימות בעלי הידע',
          dryRun,
        );
        result.canceled.push(username);
      } else result.skipped.push(username);
    } else if (warning && now.getTime() - warning.timestamp.getTime() <= 90 * DAY_MS) {
      if (dateOnly(now) < oneMonthLater(warning.timestamp)) {
        result.skipped.push(username);
      } else {
        const removed = await removeFromTopics(api, username, warning.topics, dryRun);
        const note = removed.length
          ? `בהמשך להודעה הקודמת, לאחר חודש נוסף ללא פעילות, שמך הוסר מהרשימות הבאות:\n${
            topicLinks(removed)}\n${formerExpertTemplates(removed)}`
          : 'לא נמצאו עוד רישומים להסרה מהרשימות שצוינו בהודעה הקודמת.';
        await writeTalk(
          api,
          talk,
          closeWarning(talk.content, warning, note, now),
          'עדכון על הסרה מרשימות בעלי הידע',
          dryRun,
        );
        result.removed.push(username);
      }
    } else {
      const prior = warning
        ? closeWarning(talk.content, warning, 'ההתראה הישנה פקעה. ניתנת התראה חדשה.', now)
        : talk.content;
      await writeTalk(
        api,
        talk,
        prior + warningMessage(topics, now),
        'התראה לפני הסרה מרשימות בעלי הידע',
        dryRun,
      );
      result.warned.push(username);
    }
  }
  return result;
}
