import { WikiPage } from '../../types';
import { contentFromPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';
import { TOPIC_PREFIX } from './memberships';

type Removal = { title: string; revid: number; completed?: true };
export type Pending = { warnedOn: string; topics: string[]; names?: string[]; notified?: true; removals?: Removal[] };
type Closed = { closedOn: string };
type UserState = Pending | Closed;
type UserStates = Map<string, UserState>;
type Activity = ({ kind: 'warning' } | { kind: 'removal'; title: string }) & { recovered?: boolean };

const LOG_PAGE = 'ויקיפדיה:בוט/ניקוי בעלי ידע לא פעילים';
const LOG_INTRO = 'דף זה מתעד התראות והסרות שביצע הבוט ברשימות בעלי הידע. זמני הריצות מוצגים לפי שעון ישראל.';
const ENTRY_PREFIX = '<!-- knowledge-experts: ';
const ENTRY_PATTERN = /^<!-- knowledge-experts: (.+) -->$/gm;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const runTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jerusalem',
  dateStyle: 'short',
  timeStyle: 'medium',
});

export function existingContent(page: WikiPage) {
  const { content, revid } = contentFromPage(page);
  if (page.redirect !== undefined || content === undefined || !revid) {
    throw new Error(`Cannot read editable source for ${page.title}`);
  }
  return { content, revid };
}

function isTopicTitle(title: unknown): title is string {
  return typeof title === 'string' && title.startsWith(TOPIC_PREFIX) && !/[\n\r[\]{}|<>]/.test(title);
}

function isPending(value: any): value is Pending {
  return typeof value.warnedOn === 'string' && datePattern.test(value.warnedOn)
    && Array.isArray(value.topics) && value.topics.length > 0 && value.topics.every(isTopicTitle)
    && (value.names === undefined || (Array.isArray(value.names)
      && value.names.length > 0 && value.names.every((name: unknown) => typeof name === 'string' && !!name)))
    && (value.removals === undefined || (Array.isArray(value.removals)
      && value.removals.every((item: Removal) => (
        value.topics.includes(item.title) && Number.isSafeInteger(item.revid)
      ))));
}

function parseLog(content: string): UserStates {
  const users: UserStates = new Map();
  for (const match of content.matchAll(ENTRY_PATTERN)) {
    const entry: unknown = JSON.parse(match[1]);
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !entry[1]
        || !((typeof entry[1].closedOn === 'string' && datePattern.test(entry[1].closedOn)) || isPending(entry[1]))) {
      throw new Error(`Invalid cleanup entry in ${LOG_PAGE}`);
    }
    users.set(entry[0], entry[1]);
  }
  return users;
}

function readLog(page: WikiPage, wikiUsername: string): string {
  if (page.missing !== undefined) return LOG_INTRO;
  const { content } = existingContent(page);
  if (page.revisions?.[0].user !== wikiUsername || !content.startsWith(LOG_INTRO)) {
    throw new Error(`Untrusted cleanup log in ${LOG_PAGE}`);
  }
  return content;
}

export async function writePage(api: IWikiApi, page: WikiPage, summary: string, content: string) {
  const result = page.missing !== undefined
    ? await api.create(page.title, summary, content)
    : await api.edit(page.title, summary, content, existingContent(page).revid);
  if (result?.edit?.result !== 'Success') throw new Error(`Edit failed for ${page.title}`);
  return result.edit.newrevid ?? result.edit.oldrevid;
}

function formatActivity(username: string, activity: Activity): string {
  const task = activity.kind === 'warning'
    ? `נשלחה התראה ל[[שיחת משתמש:${username}|${username}]].`
    : `[[משתמש:${username}|${username}]] הוסר מרשימת [[${activity.title}|${activity.title.slice(TOPIC_PREFIX.length)}]].`;
  return `* ${task}${activity.recovered ? ' הפעולה בוצעה בריצה קודמת ותועדה לפי היסטוריית העריכות.' : ''}`;
}

export async function openRunLog(api: IWikiApi, wikiUsername: string, now: Date, dryRun: boolean) {
  let page = await api.getPage(LOG_PAGE);
  let content = readLog(page, wikiUsername);
  const users = parseLog(content);
  let actions = 0;

  async function append(summary: string, text: string) {
    if (dryRun) return;
    const updated = content + text;
    const revid = await writePage(api, page, summary, updated);
    page = {
      ...page,
      missing: undefined,
      revisions: [{
        revid,
        user: wikiUsername,
        size: updated.length,
        slots: { main: { '*': updated, contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
      }],
    };
    content = updated;
  }

  await append('פתיחת ריצת ניקוי בעלי ידע', `\n\n== ${runTime.format(now)} ==\n`);

  async function save(username: string, state: UserState, activity?: Activity) {
    const entry = JSON.stringify([username, state]).replaceAll('>', '\\u003e');
    const record = `${ENTRY_PREFIX}${entry} -->\n`;
    if (activity) {
      const summary = activity.kind === 'warning' ? 'רישום התראה ביומן הבוט' : 'רישום הסרה ביומן הבוט';
      await append(summary, `${formatActivity(username, activity)}\n${record}`);
      actions += 1;
    } else {
      await append('עדכון מעקב אחר תחזוקת בעלי הידע', record);
    }
    users.set(username, state);
  }

  async function finish(failures: number) {
    const summary = actions > 0 ? 'הריצה הסתיימה.' : 'הריצה הסתיימה. לא תועדו התראות או הסרות.';
    const failed = failures > 0 ? ` נמצאו שגיאות בטיפול במשתמשים (${failures}).` : '';
    await append('סיום ריצת ניקוי בעלי ידע', `* ${summary}${failed}\n`);
  }

  return { users, save, finish };
}
