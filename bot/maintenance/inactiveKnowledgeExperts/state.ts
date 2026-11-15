import { WikiPage } from '../../types';
import { contentFromPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';
import { TOPIC_PREFIX } from './memberships';

type Removal = { title: string; revid: number };

export type Pending = { warnedOn: string; topics: string[]; removals?: Removal[] };
type Closed = { closedOn: string };
type UserState = Pending | Closed;
type UserStates = Map<string, UserState>;

const STATE_HEADER = '<pre class="inactive-knowledge-experts-state">';
const STATE_FOOTER = '</pre>';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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
    && (value.removals === undefined || (Array.isArray(value.removals)
      && value.removals.every((item: Removal) => (
        value.topics.includes(item.title) && Number.isSafeInteger(item.revid)
      ))));
}

function loadState(page: WikiPage, botName: string): UserStates {
  if (page.missing !== undefined) return new Map();
  const { content } = existingContent(page);
  if (page.revisions?.[0].user !== botName
      || !content.startsWith(STATE_HEADER) || !content.endsWith(STATE_FOOTER)) {
    throw new Error(`Untrusted cleanup state in ${page.title}`);
  }

  const entries: unknown = JSON.parse(content.slice(STATE_HEADER.length, -STATE_FOOTER.length));
  if (!Array.isArray(entries) || !entries.every((entry) => (
    Array.isArray(entry) && typeof entry[0] === 'string' && entry[1]
    && ((typeof entry[1].closedOn === 'string' && datePattern.test(entry[1].closedOn)) || isPending(entry[1]))
  ))) throw new Error(`Invalid cleanup state in ${page.title}`);
  return new Map(entries);
}

export async function writePage(api: IWikiApi, page: WikiPage, summary: string, content: string) {
  const result = page.missing !== undefined
    ? await api.create(page.title, summary, content)
    : await api.edit(page.title, summary, content, existingContent(page).revid);
  if (result?.edit?.result !== 'Success') throw new Error(`Edit failed for ${page.title}`);
  return result.edit.newrevid ?? result.edit.oldrevid;
}

export async function readState(api: IWikiApi, botName: string, month: string, dryRun: boolean) {
  const title = `משתמש:${botName}/תחזוקת בעלי ידע`;
  const page = await api.getPage(title);
  const users = loadState(page, botName);
  let currentPage = page;

  async function save(username: string, state: UserState) {
    const updated = new Map([...users].filter(
      ([, value]) => !('closedOn' in value) || value.closedOn.startsWith(month),
    ));
    updated.set(username, state);
    if (!dryRun) {
      const encoded = JSON.stringify([...updated]).replaceAll('<', '\\u003c');
      const content = `${STATE_HEADER}${encoded}${STATE_FOOTER}`;
      const revid = await writePage(api, currentPage, 'עדכון מעקב אחר תחזוקת בעלי הידע', content);
      currentPage = {
        ...page,
        missing: undefined,
        revisions: [{
          revid,
          user: botName,
          size: content.length,
          slots: { main: { '*': content, contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        }],
      };
    }
    users.set(username, state);
  }

  return { users, save };
}
