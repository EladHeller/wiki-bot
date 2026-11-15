import { WikiPage } from '../../types';
import { logger } from '../../utilities/logger';
import { IWikiApi } from '../../wiki/WikiApi';
import {
  isTopic, listKnowledgeExperts, TOPIC_PREFIX, withoutMember,
} from './memberships';
import {
  existingContent, Pending, readState, writePage,
} from './state';

type Options = { botName: string; now?: Date; dryRun?: boolean };
type Outcome = 'warned' | 'removed' | 'closed' | 'skipped';
type Report = Record<Outcome, string[]> & { dryRun: boolean; failed: string[] };

const HEADING = 'רשימות בעלי הידע';
const warningSummary = (date: string) => `הודעה על חוסר פעילות ברשימות בעלי הידע (${date})`;
const closureSummary = (date: string) => `עדכון בנוגע לרשימות בעלי הידע (${date})`;
const warningMarker = (date: string) => `<!-- Sapper-bot:knowledge-expert:v2:${date} -->`;
const closedMarker = (date: string) => `<!-- Sapper-bot:knowledge-expert:closed:${date} -->`;
const israelDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jerusalem' });
const topicLinks = (titles: string[]) => titles.map((title) => `* [[${title}]]`).join('\n');

function shiftDate(date: Date, years: number, months: number): Date {
  const target = new Date(date);
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCFullYear(target.getUTCFullYear() + years, target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function readTalk(page: WikiPage): string {
  return page.missing !== undefined ? '' : existingContent(page).content;
}

function warningText(warning: Pending): string {
  return `\n\n== ${HEADING} ==\n${warningMarker(warning.warnedOn)}\n`
    + 'שלום, ותודה על נכונותך לשתף מהידע שלך עם עורכי ויקיפדיה. שמך מופיע ברשימות הבאות:\n'
    + `${topicLinks(warning.topics)}\n\n`
    + 'חלפו לפחות שלוש שנים מאז העריכה האחרונה שלך בוויקיפדיה העברית. '
    + 'כדי שהפניות ברשימות יגיעו לעורכים שזמינים להשיב, בעוד כחודש נסיר את שמך מהרשימות האלה. '
    + 'עריכה בוויקיפדיה העברית לפני ההסרה תשאיר את שמך ברשימות. '
    + 'גם אחרי ההסרה אפשר להוסיף את שמך בחזרה בכל עת. תודה על תרומתך לוויקיפדיה. ~~~~\n';
}

function warningSection(content: string, date: string): number {
  const marker = `== ${HEADING} ==\n${warningMarker(date)}\n`;
  const start = content.indexOf(marker);
  if (start < 0) return -1;
  const afterMarker = start + marker.length;
  const nextHeading = /^==(?!=).+?==[ \t]*$/m.exec(content.slice(afterMarker));
  return nextHeading ? afterMarker + nextHeading.index : content.length;
}

function followUp(content: string, warning: Pending, removed: string[], active: boolean): string {
  const date = warning.warnedOn;
  const end = warningSection(content, date);
  if (end < 0 && removed.length === 0) return content;

  const links = removed.map((title) => `[[${title}|${title.slice(TOPIC_PREFIX.length)}]]`).join(', ');
  const message = removed.length > 0 ? `שמך הוסר מרשימות בעלי הידע בתחומים ${links}. `
    + 'אפשר להוסיף את שמך בחזרה בכל עת. תודה על תרומתך לוויקיפדיה.'
    : 'הטיפול ברשימות שהוזכרו בהודעה הסתיים.';
  const response = active
    ? `${removed.length > 0 ? `${message} ` : ''}תודה על חזרתך לפעילות. אין צורך בהסרה נוספת.`
    : message;
  const note = `${response} ~~~~\n${closedMarker(date)}\n`;
  if (end < 0) return `${content.trimEnd()}\n\n== ${HEADING} ==\n${note}`;
  return `${content.slice(0, end).trimEnd()}\n\n: ${note}\n${content.slice(end)}`;
}

async function recentlyActive(api: IWikiApi, username: string, now: Date): Promise<boolean> {
  for await (const edits of api.userContributes(username, shiftDate(now, -3, 0), now, 1)) {
    if (edits.length > 0) return true;
  }
  return false;
}

async function readTopic(api: IWikiApi, title: string, username: string) {
  const page = await api.getPage(title);
  if (page.missing !== undefined || page.redirect !== undefined) return undefined;
  const { content, revid } = existingContent(page);
  if (!isTopic(content)) return undefined;
  return { page, revid, updated: withoutMember(content, username) };
}

async function botEdited(
  api: IWikiApi,
  title: string,
  summary: string,
  botName: string,
  warnedOn: string,
  baseRev = 0,
) {
  const since = new Date(warnedOn);
  since.setUTCDate(since.getUTCDate() - 1);
  for await (const revisions of api.getArticleRevisions(title, 25, 'ids|user|comment', { user: botName, since })) {
    for (const { revid, user, comment } of revisions) {
      if ((revid as number) <= baseRev) return false;
      if (user === botName && comment === summary) return true;
    }
  }
  return false;
}

async function planRemovals(api: IWikiApi, warning: Pending, username: string): Promise<Pending> {
  const removals: NonNullable<Pending['removals']> = [];
  for (const title of warning.topics) {
    const topic = await readTopic(api, title, username);
    if (topic && topic.updated !== undefined) removals.push({ title, revid: topic.revid });
  }
  return { ...warning, removals };
}

async function removeFromTopics(
  api: IWikiApi,
  warning: Pending & Required<Pick<Pending, 'removals'>>,
  username: string,
  botName: string,
  canRemove: boolean,
  dryRun: boolean,
) {
  const removed: string[] = [];
  const summary = `הסרה מרשימת בעלי ידע לאחר התראה ([[משתמש:${username}]], ${warning.warnedOn})`;
  for (const { title, revid } of warning.removals) {
    const topic = await readTopic(api, title, username);
    if (topic) {
      const alreadyRemoved = topic.revid !== revid
        && await botEdited(api, title, summary, botName, warning.warnedOn, revid);
      if (alreadyRemoved) {
        if (topic.updated === undefined) removed.push(title);
      } else if (canRemove && topic.updated !== undefined) {
        if (!dryRun) await writePage(api, topic.page, summary, topic.updated);
        removed.push(title);
      }
    }
  }
  return removed;
}

async function processUser(
  api: IWikiApi,
  username: string,
  topics: string[],
  state: Awaited<ReturnType<typeof readState>>,
  options: Required<Options>,
  today: string,
): Promise<Outcome> {
  const current = state.users.get(username);
  if (current && 'closedOn' in current && current.closedOn.slice(0, 7) === today.slice(0, 7)) return 'skipped';
  const warning = current && 'warnedOn' in current ? current : undefined;
  const title = `שיחת משתמש:${username}`;
  if (!warning && await recentlyActive(api, username, options.now)) return 'skipped';

  const talk = await api.getPage(title);
  const content = readTalk(talk);
  if (warning && content.includes(closedMarker(warning.warnedOn))) {
    await state.save(username, { closedOn: today });
    return 'skipped';
  }

  const noticeExists = !!warning && warningSection(content, warning.warnedOn) >= 0;
  const sameMonth = warning?.warnedOn.slice(0, 7) === today.slice(0, 7);
  if (noticeExists && sameMonth) return 'skipped';

  if (warning?.removals && !noticeExists
    && await botEdited(api, title, closureSummary(warning.warnedOn), options.botName, warning.warnedOn)) {
    await state.save(username, { closedOn: today });
    return 'skipped';
  }

  const active = !!warning && await recentlyActive(api, username, options.now);
  if (!warning || (!noticeExists && !warning.removals && !active)) {
    if (!topics.length) {
      await state.save(username, { closedOn: today });
      return 'skipped';
    }
    if (warning && sameMonth
        && await botEdited(api, title, warningSummary(warning.warnedOn), options.botName, warning.warnedOn)) {
      return 'skipped';
    }
    const newWarning = { warnedOn: today, topics };
    await state.save(username, newWarning);
    if (!options.dryRun) {
      await writePage(api, talk, warningSummary(today), content + warningText(newWarning));
    }
    return 'warned';
  }

  if (!active && noticeExists && !warning.removals) {
    const due = shiftDate(new Date(`${warning.warnedOn}T00:00:00Z`), 0, 1).toISOString().slice(0, 10);
    if (today < due) return 'skipped';
    const delivered = await botEdited(api, title, warningSummary(warning.warnedOn), options.botName, warning.warnedOn);
    if (!delivered) throw new Error(`Cannot verify warning for ${username}`);
  }

  const plan = active || !noticeExists || warning.removals
    ? warning
    : await planRemovals(api, warning, username);
  if (plan !== warning) await state.save(username, plan);
  const canRemove = !active && noticeExists;
  const removed = plan.removals
    ? await removeFromTopics(
      api,
      { ...plan, removals: plan.removals },
      username,
      options.botName,
      canRemove,
      options.dryRun,
    )
    : [];
  const latestTalk = removed.length > 0 ? await api.getPage(title) : talk;
  const latestContent = readTalk(latestTalk);
  const updated = followUp(latestContent, plan, removed, active);
  if (!options.dryRun && updated !== latestContent) {
    await writePage(api, latestTalk, closureSummary(plan.warnedOn), updated);
  }
  await state.save(username, { closedOn: today });
  return removed.length > 0 ? 'removed' : 'closed';
}

export default async function runInactiveKnowledgeExperts(api: IWikiApi, options: Options): Promise<Report> {
  const { now = new Date(), botName, dryRun = true } = options;
  const today = israelDate.format(now);
  const state = await readState(api, botName, today.slice(0, 7), dryRun);
  const topicsByUser = await listKnowledgeExperts(api);
  const pendingUsers = [...state.users].filter(([, status]) => 'warnedOn' in status).map(([username]) => username);
  const usernames = [...new Set([...pendingUsers, ...topicsByUser.keys()])];
  const cutoff = shiftDate(now, -3, 0);
  const accounts = await api.registeredUsers(usernames);
  const eligible = new Set(accounts.filter(({ registration }) => !registration || new Date(registration) <= cutoff)
    .map(({ name }) => name));
  const report: Report = {
    dryRun, warned: [], removed: [], closed: [], skipped: [], failed: [],
  };

  for (const username of usernames) {
    try {
      if (eligible.has(username)) {
        const topics = topicsByUser.get(username) ?? [];
        const outcome = await processUser(api, username, topics, state, { now, botName, dryRun }, today);
        report[outcome].push(username);
      } else {
        if (pendingUsers.includes(username)) await state.save(username, { closedOn: today });
        report.skipped.push(username);
      }
    } catch (error) {
      logger.logError(`Knowledge-expert maintenance failed for ${username}: ${error}`);
      report.failed.push(username);
    }
  }
  return report;
}
