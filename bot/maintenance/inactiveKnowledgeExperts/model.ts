import { WikiPage } from '../../types';
import { logger } from '../../utilities/logger';
import { IWikiApi } from '../../wiki/WikiApi';
import {
  isTopic, listKnowledgeExperts, TOPIC_PREFIX, withoutMember,
} from './memberships';
import {
  existingContent, openRunLog, Pending, Member, writePage,
} from './runLog';

type Options = { wikiUsername: string; now?: Date; dryRun?: boolean };
type RunLog = Awaited<ReturnType<typeof openRunLog>>;
type Outcome = 'warned' | 'removed' | 'closed' | 'skipped';
type Report = Record<Outcome, string[]> & { dryRun: boolean; failed: string[]; errors: Record<string, string> };

const HEADING = 'בעלי ידע לא פעילים';
const LEGACY_HEADING = 'רשימות בעלי הידע';
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

const botTalkLink = (wikiUsername: string) => `[[שיחת משתמש:${wikiUsername}|דף השיחה של הבוט]]`;

function warningText(warning: Pending, username: string, wikiUsername: string): string {
  return `\n\n== ${HEADING} ==\n${warningMarker(warning.warnedOn)}\nשלום ${username},\n\n`
    + 'במסגרת תחזוקה שוטפת של תבניות בעלי הידע, נמצא כי לא נרשמה פעילות משם המשתמש שלך '
    + 'בוויקיפדיה העברית בשלוש השנים האחרונות.\n\n'
    + 'נכון להיום, שמך רשום ב[[תבנית:בעלי ידע|תבניות בעלי הידע]] הבאות:\n'
    + `${topicLinks(warning.topics)}\n\n`
    + 'מאחר שהרשמה לתבניות אלה נועדה לאפשר לעורכים אחרים לתייג בעלי ידע בדיונים רלוונטיים, '
    + 'ולאור חוסר הפעילות הממושך, יוסר שמך מהתבניות המפורטות לעיל בעוד כחודש, '
    + 'אם לא תירשם פעילות עד אז. הודעה מפורשת על ההסרה תופיע בדף שיחתך, בעת ביצועה. '
    + `אם נפלה טעות בהודעה זו, ניתן לפנות ל${botTalkLink(wikiUsername)}.\n\n`
    + 'במקרה של חזרה לפעילות מאוחר יותר, ניתן להוסיף את שמך מחדש לתבניות הרלוונטיות.\n\n'
    + 'בידידות והערכה על תרומתך לוויקיפדיה, ~~~~\n';
}

function removalText(warning: Pending, removed: string[], username: string, wikiUsername: string): string {
  return `=== הסרה מתבניות בעלי ידע ===\nשלום ${username},\n\n`
    + `בהמשך להודעה מ־${warning.warnedOn}, ומאחר שלא נרשמה פעילות משם המשתמש שלך `
    + 'בוויקיפדיה העברית בשלוש השנים האחרונות, הוסר שמך '
    + 'מ[[תבנית:בעלי ידע|תבניות בעלי הידע]] הבאות:\n'
    + `${topicLinks(removed)}\n\n`
    + 'ההסרה נעשתה במסגרת תחזוקה שגרתית של רשימות בעלי הידע, '
    + 'ואין בה משום ביקורת לגבי תרומתך או ידיעותיך. מטרתה היא לשמור על רשימות מעודכנות, '
    + 'כך שתיוג בעלי ידע יפנה בעיקר לעורכים שעשויים להיות זמינים להשתתף בדיונים.\n\n'
    + 'במקרה של חזרה לפעילות ורצון להירשם שוב לתחום כלשהו, '
    + 'ניתן להוסיף את שמך לתבנית הרלוונטית בכל עת. '
    + `אם לדעתך ההסרה נעשתה בטעות, ניתן לפנות ל${botTalkLink(wikiUsername)}.\n\n`
    + 'בידידות והערכה על תרומתך לוויקיפדיה, ~~~~\n';
}

function warningSection(content: string, date: string): number {
  for (const heading of [HEADING, LEGACY_HEADING]) {
    const marker = `== ${heading} ==\n${warningMarker(date)}\n`;
    const start = content.indexOf(marker);
    if (start >= 0) {
      const afterMarker = start + marker.length;
      const nextHeading = /^==(?!=).+?==[ \t]*$/m.exec(content.slice(afterMarker));
      return nextHeading ? afterMarker + nextHeading.index : content.length;
    }
  }
  return -1;
}

function followUp(
  content: string,
  warning: Pending,
  removed: string[],
  active: boolean,
  username: string,
  wikiUsername: string,
): string {
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
  const notice = removed.length > 0 && !active
    ? removalText(warning, removed, username, wikiUsername)
    : `: ${response} ~~~~\n`;
  const note = `${notice}${closedMarker(date)}\n`;
  if (end < 0) return `${content.trimEnd()}\n\n== ${HEADING} ==\n${note}`;
  return `${content.slice(0, end).trimEnd()}\n\n${note}\n${content.slice(end)}`;
}

async function recentlyActive(api: IWikiApi, username: string, now: Date): Promise<boolean> {
  for await (const edits of api.userContributes(username, shiftDate(now, -3, 0), now, 1)) {
    if (edits.length > 0) return true;
  }
  return false;
}

async function readTopic(api: IWikiApi, title: string, usernames: string[]) {
  const page = await api.getPage(title);
  if (page.missing !== undefined || page.redirect !== undefined) return undefined;
  const { content, revid } = existingContent(page);
  if (!isTopic(content)) return undefined;
  const updated = usernames.reduce((text, username) => withoutMember(text, username) ?? text, content);
  return { page, revid, updated: updated === content ? undefined : updated };
}

async function accountEdited(
  api: IWikiApi,
  title: string,
  summary: string,
  wikiUsername: string,
  warnedOn: string,
  baseRev = 0,
) {
  const since = new Date(warnedOn);
  since.setUTCDate(since.getUTCDate() - 1);
  for await (const revisions of api.getArticleRevisions(title, 25, 'ids|user|comment', { user: wikiUsername, since })) {
    for (const { revid, user, comment } of revisions) {
      if ((revid as number) <= baseRev) return false;
      if (user === wikiUsername && comment === summary) return true;
    }
  }
  return false;
}

async function planRemovals(api: IWikiApi, warning: Pending, username: string): Promise<Pending> {
  const removals: NonNullable<Pending['removals']> = [];
  const members = warning.members ?? [{ username, topics: warning.topics }];
  for (const title of warning.topics) {
    const usernames = members.filter((member) => member.topics.includes(title)).map((member) => member.username);
    const topic = await readTopic(api, title, usernames);
    if (topic && topic.updated !== undefined) removals.push({ title, revid: topic.revid, usernames });
  }
  return { ...warning, removals };
}

async function removeFromTopics(
  api: IWikiApi,
  warning: Pending & Required<Pick<Pending, 'removals'>>,
  username: string,
  log: RunLog,
  options: Required<Options>,
  canRemove: boolean,
) {
  const removed: string[] = [];
  const summary = `הסרה מרשימת בעלי ידע לאחר התראה ([[משתמש:${username}]], ${warning.warnedOn})`;
  let { removals } = warning;
  for (const entry of warning.removals) {
    const { title, revid, completed } = entry;
    const topic = await readTopic(api, title, entry.usernames ?? [username]);
    if (topic) {
      const recovered = !completed && topic.revid !== revid
        && await accountEdited(api, title, summary, options.wikiUsername, warning.warnedOn, revid);
      const { updated } = topic;
      const shouldRemove = !completed && !recovered && canRemove && updated !== undefined;
      if (shouldRemove && !options.dryRun) await writePage(api, topic.page, summary, updated);
      if (shouldRemove || recovered) {
        removals = removals.map((item) => (item === entry ? { ...entry, completed: true } : item));
        await log.save(username, { ...warning, removals }, { kind: 'removal', title, recovered });
      }
      if (shouldRemove || ((completed || recovered) && updated === undefined)) removed.push(title);
    }
  }
  return removed;
}

async function processUser(
  api: IWikiApi,
  username: string,
  members: Member[],
  log: RunLog,
  options: Required<Options>,
  today: string,
): Promise<Outcome> {
  const topics = [...new Set(members.flatMap((member) => member.topics))];
  const current = log.users.get(username);
  if (current && 'closedOn' in current && current.closedOn.slice(0, 7) === today.slice(0, 7)) return 'skipped';
  let warning = current && 'warnedOn' in current ? current : undefined;
  const title = `שיחת משתמש:${username}`;
  if (!warning && await recentlyActive(api, username, options.now)) return 'skipped';

  if (warning && !warning.notified
      && await accountEdited(api, title, warningSummary(warning.warnedOn), options.wikiUsername, warning.warnedOn)) {
    warning = { ...warning, notified: true };
    await log.save(username, warning, { kind: 'warning', recovered: true });
  }
  if (warning?.notified && warning.warnedOn.slice(0, 7) === today.slice(0, 7)) return 'skipped';

  const talk = await api.getPage(title);
  const content = readTalk(talk);
  if (warning && content.includes(closedMarker(warning.warnedOn))) {
    await log.save(username, { closedOn: today });
    return 'skipped';
  }

  const noticeExists = !!warning && warningSection(content, warning.warnedOn) >= 0;

  if (warning?.removals && !noticeExists
    && await accountEdited(api, title, closureSummary(warning.warnedOn), options.wikiUsername, warning.warnedOn)) {
    await log.save(username, { closedOn: today });
    return 'skipped';
  }

  const active = !!warning && await recentlyActive(api, username, options.now);
  if (!warning || (!noticeExists && !warning.removals && !active)) {
    if (!topics.length) {
      await log.save(username, { closedOn: today });
      return 'skipped';
    }
    const newWarning = { warnedOn: today, topics, members };
    await log.save(username, newWarning);
    if (!options.dryRun) {
      const message = warningText(newWarning, username, options.wikiUsername);
      await writePage(api, talk, warningSummary(today), content + message);
    }
    await log.save(username, { ...newWarning, notified: true }, { kind: 'warning' });
    return 'warned';
  }

  if (!active && noticeExists && !warning.removals) {
    const due = shiftDate(new Date(`${warning.warnedOn}T00:00:00Z`), 0, 1).toISOString().slice(0, 10);
    if (today < due) return 'skipped';
    if (!warning.notified) throw new Error(`Cannot verify warning for ${username}`);
  }

  const plan = active || !noticeExists || warning.removals
    ? warning
    : await planRemovals(api, warning, username);
  if (plan !== warning) await log.save(username, plan);
  const canRemove = !active && noticeExists;
  const removed = plan.removals
    ? await removeFromTopics(
      api,
      { ...plan, removals: plan.removals },
      username,
      log,
      options,
      canRemove,
    )
    : [];
  const latestTalk = removed.length > 0 ? await api.getPage(title) : talk;
  const latestContent = readTalk(latestTalk);
  const updated = followUp(latestContent, plan, removed, active, username, options.wikiUsername);
  if (!options.dryRun && updated !== latestContent) {
    await writePage(api, latestTalk, closureSummary(plan.warnedOn), updated);
  }
  await log.save(username, { closedOn: today });
  return removed.length > 0 ? 'removed' : 'closed';
}

export default async function runInactiveKnowledgeExperts(api: IWikiApi, options: Options): Promise<Report> {
  const { now = new Date(), wikiUsername, dryRun = true } = options;
  const today = israelDate.format(now);
  const log = await openRunLog(api, wikiUsername, now, dryRun);
  const topicsByUser = await listKnowledgeExperts(api);
  const redirects = await api.userPageRedirects([...topicsByUser.keys()]);
  const membersByUser = new Map<string, Member[]>();
  topicsByUser.forEach((topics, username) => {
    const canonical = redirects.get(username) ?? username;
    const members = membersByUser.get(canonical) ?? [];
    membersByUser.set(canonical, [...members, { username, topics }]);
  });
  const pendingUsers = [...log.users].filter(([, status]) => 'warnedOn' in status).map(([username]) => username);
  const usernames = [...new Set([...pendingUsers, ...membersByUser.keys()])];
  const cutoff = shiftDate(now, -3, 0);
  const accounts = await api.registeredUsers(usernames);
  const eligible = new Set(accounts.filter(({ registration }) => !registration || new Date(registration) <= cutoff)
    .map(({ name }) => name));
  const report: Report = {
    dryRun, warned: [], removed: [], closed: [], skipped: [], failed: [], errors: {},
  };

  for (const username of usernames) {
    try {
      if (eligible.has(username)) {
        const members = membersByUser.get(username) ?? [];
        const outcome = await processUser(api, username, members, log, { now, wikiUsername, dryRun }, today);
        report[outcome].push(username);
      } else {
        if (pendingUsers.includes(username)) await log.save(username, { closedOn: today });
        report.skipped.push(username);
      }
    } catch (error) {
      logger.logError(`Knowledge-expert maintenance failed for ${username}: ${error}`);
      report.failed.push(username);
      report.errors[username] = error instanceof Error ? error.stack ?? error.message : String(error);
    }
  }
  await log.finish(report.failed.length);
  return report;
}
