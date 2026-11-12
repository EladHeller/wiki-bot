import type { Revision, WikiPage } from '../../types';
import type { IWikiApi } from '../../wiki/WikiApi';
import { logger } from '../../utilities/logger';
import {
  assessDiscussion, discussionMessage, importanceTemplates, matchesPlacementDate, templateNames,
} from './wikitext';

const day = 24 * 60 * 60 * 1000;
const gracePeriod = 30 * 60 * 1000;
const historyLimit = 500;
const summary = 'פתיחת דיון חשיבות בעקבות הצבת תבנית';

type Snapshot = { content: string; revid: number; pageid: number; missing: boolean };
type Placement = { revid: number; timestamp: string; user: string };
type State = Record<string, 'pending' | 'done'>;
type Options = { stateTitle: string; dryRun: boolean; now?: Date };

export default function ImportanceDiscussionsModel(api: IWikiApi, options: Options) {
  const now = options.now ?? new Date();
  let state: State = {};
  let statePage: Snapshot;

  async function readPage(title: string): Promise<Snapshot> {
    const result = await api.request('?action=query&format=json&prop=revisions%7Cinfo&rvprop=ids%7Ccontent&rvslots=main'
      + `&titles=${encodeURIComponent(title)}`);
    const [page] = Object.values(result.query.pages) as WikiPage[];
    if ('missing' in page) {
      return {
        content: '', revid: 0, pageid: 0, missing: true,
      };
    }
    if ('redirect' in page) throw new Error(`Redirect requires manual review: ${title}`);
    const revision = page.revisions?.[0];
    const content = revision?.slots?.main?.['*'];
    if (!revision?.revid || typeof content !== 'string') throw new Error(`Unreadable page: ${title}`);
    return {
      content, revid: revision.revid, pageid: page.pageid, missing: false,
    };
  }

  async function saveState(key: string, status: 'pending' | 'done') {
    const nextState = { ...state, [key]: status };
    const content = JSON.stringify(nextState, null, 2);
    const result = statePage.missing
      ? await api.create(options.stateTitle, 'עדכון מעקב דיוני חשיבות', content)
      : await api.edit(options.stateTitle, 'עדכון מעקב דיוני חשיבות', content, statePage.revid);
    if (result?.edit?.result !== 'Success' || !result.edit.newrevid) {
      throw new Error('Failed to persist importance discussion state');
    }
    state = nextState;
    statePage = {
      content, revid: result.edit.newrevid, pageid: result.edit.pageid, missing: false,
    };
  }

  async function findPlacement(title: string, source: Snapshot): Promise<Placement | null> {
    let placement: Placement | null = null;
    let count = 0;
    for await (const revisions of api.getArticleRevisions(title, 50, 'ids|timestamp|user|content')) {
      for (const revision of revisions) {
        const content = revision.slots?.main?.['*'];
        if (!revision.revid || !revision.timestamp || typeof content !== 'string') {
          throw new Error(`Incomplete history: ${title}`);
        }
        if (count === 0 && revision.revid !== source.revid) return null;
        count += 1;
        if (!importanceTemplates(content, title).length) return placement;
        const age = now.getTime() - Date.parse(revision.timestamp);
        if (!Number.isFinite(age) || age >= 7 * day || count > historyLimit) return null;
        if (!revision.user) throw new Error(`Unknown template placer: ${title}`);
        placement = { revid: revision.revid, timestamp: revision.timestamp, user: revision.user };
        if ((revision as Revision & { parentid?: number }).parentid === 0) return placement;
      }
    }
    throw new Error(`Could not establish template placement: ${title}`);
  }

  async function talkBeforePlacement(title: string, timestamp: string) {
    const cutoff = new Date(Date.parse(timestamp) - day).toISOString();
    const result = await api.request('?action=query&format=json&prop=revisions&rvprop=content&rvslots=main&rvlimit=1'
      + `&rvstart=${encodeURIComponent(cutoff)}&titles=${encodeURIComponent(title)}`);
    const [page] = Object.values(result.query.pages) as WikiPage[];
    if (!page.revisions?.length) return '';
    const content = page.revisions[0].slots?.main?.['*'];
    if (typeof content !== 'string') throw new Error(`Unreadable talk history: ${title}`);
    return content;
  }

  async function processPage(page: WikiPage) {
    const source = await readPage(page.title);
    const templates = importanceTemplates(source.content, page.title);
    if (!templates.length) return;
    if (templates.length !== 1 || templates[0].data.keyValueData?.['סוג']) {
      logger.logWarning(`Importance template requires manual review: [[${page.title}]]`);
      return;
    }
    const placement = await findPlacement(page.title, source);
    if (!placement || now.getTime() - Date.parse(placement.timestamp) < gracePeriod) return;
    const { data } = templates[0];
    const declaredDate = data.arrayData?.[0] ?? data.keyValueData?.['זמן'];
    if (!matchesPlacementDate(declaredDate, placement.timestamp)) {
      logger.logWarning(`Template date differs from placement history; manual review: [[${page.title}]]`);
      return;
    }
    const key = `${source.pageid}:${placement.revid}`;
    if (state[key]) {
      if (state[key] === 'pending') {
        logger.logWarning(`Uncertain previous importance edit; review before retrying: [[${page.title}]] (${key})`);
      }
      return;
    }
    const articleTitle = page.ns === 1 ? page.title.replace(/^שיחה:/, '') : page.title;
    const talkTitle = `שיחה:${articleTitle}`;
    const talk = await readPage(talkTitle);
    const baseline = await talkBeforePlacement(talkTitle, placement.timestamp);
    const assessment = assessDiscussion(baseline, talk.content, talkTitle);
    if (assessment === 'uncertain') {
      logger.logWarning(`Possible existing importance discussion; manual review: [[${talkTitle}]]`);
      return;
    }
    if (assessment === 'existing' || talk.content.includes(`<!-- importance-discussion:${placement.revid} -->`)) {
      if (!options.dryRun) await saveState(key, 'done');
      return;
    }
    const freshSource = await readPage(page.title);
    const freshTalk = await readPage(talkTitle);
    if (freshSource.revid !== source.revid || freshTalk.revid !== talk.revid) {
      console.log(`Page changed during importance check: ${page.title}`);
      return;
    }
    const heading = `חשיבות: ${articleTitle}`;
    const message = discussionMessage(articleTitle, placement.user, placement.timestamp, placement.revid);
    if (options.dryRun) {
      logger.logInfo(`[[${talkTitle}]] — פתיחת פרק „${heading}”, בעקבות [[מיוחד:הבדל/${placement.revid}|הצבת התבנית]]`);
      return;
    }
    await saveState(key, 'pending');
    const result = talk.missing
      ? await api.create(talkTitle, summary, `== ${heading} ==\n${message}\n`)
      : await api.edit(talkTitle, summary, `${talk.content}\n\n== ${heading} ==\n${message}\n`, talk.revid);
    if (result?.edit?.result !== 'Success') {
      throw new Error(`Importance discussion edit was not confirmed: ${talkTitle}`);
    }
    await saveState(key, 'done');
    console.log(`Created importance discussion: ${talkTitle}`);
  }

  async function run() {
    statePage = await readPage(options.stateTitle);
    state = statePage.missing ? {} : JSON.parse(statePage.content);
    if (!state || Array.isArray(state) || typeof state !== 'object'
      || Object.values(state).some((status) => status !== 'pending' && status !== 'done')) {
      throw new Error('Invalid importance discussion state');
    }
    const seen = new Set<number>();
    for (const name of templateNames) {
      for await (const pages of api.getArticlesWithTemplate(name, undefined, 'תבנית', '0|1')) {
        for (const page of pages) {
          if (!seen.has(page.pageid)) {
            seen.add(page.pageid);
            try {
              await processPage(page);
            } catch (error) {
              logger.logError(`Importance discussion failed for [[${page.title}]]: ${String(error)}`);
            }
          }
        }
      }
    }
  }

  return { run };
}
