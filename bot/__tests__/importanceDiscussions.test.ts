import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import ImportanceDiscussionsModel from '../maintenance/importanceDiscussions/model';
import {
  assessDiscussion, discussionMessage, importanceTemplates, matchesPlacementDate,
} from '../maintenance/importanceDiscussions/wikitext';
import { logger } from '../utilities/logger';
import type { Revision, WikiPage } from '../types';

const title = 'ערך לדוגמה';
const talkTitle = `שיחה:${title}`;
const stateTitle = 'ויקיפדיה:בוט/דיוני חשיבות/מצב';
const template = '{{הבהרת חשיבות עם זמן|זמן=6.10.2026}}';
const now = new Date('2026-10-07T10:00:00Z');
const placedAt = '2026-10-06T10:00:00Z';

function revision(content = template, revid = 20, timestamp = placedAt, user = 'בודק') {
  return {
    revid,
    timestamp,
    user,
    size: content.length,
    parentid: revid - 1,
    slots: { main: { '*': content, contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
  };
}
function page(content: string, revid = 20, pageid = 1) {
  return { pageid, revisions: [revision(content, revid)] };
}
function candidate(pageTitle = title, ns = 0, pageid = 1) {
  return { title: pageTitle, ns, pageid } as WikiPage;
}

describe('importance discussion wikitext', () => {
  it.each(['חשיבות', 'הבהרת חשיבות', 'הבהרת חשיבות עם זמן', 'תבנית:חשיבות', 'Template:חשיבות'])('recognizes %s with whitespace and nested parameters', (name) => {
    expect(importanceTemplates(`{{ ${name} |זמן={{תאריך}} }}`, title)).toHaveLength(1);
  });

  it('supports underscores and excludes inert and similarly named templates', () => {
    const text = '<!-- {{חשיבות}} --><nowiki>{{חשיבות}}</nowiki><math>{{חשיבות}}</math>'
      + '{{חשיבות אחרת}}{{הבהרת_חשיבות_עם_זמן|זמן=6.10.2026}}';

    expect(importanceTemplates(text, title)).toStrictEqual([{
      text: template, data: { arrayData: [], keyValueData: { זמן: '6.10.2026' } },
    }]);
  });

  it.each([
    ['', '', 'none'],
    ['', `${template}\n<!-- comment --><nowiki>example</nowiki><math>x</math>`, 'none'],
    ['== חשיבות ==\nדיון ישן', '== חשיבות ==\nדיון ישן', 'none'],
    ['== חשיבות ==\nישן', '== חשיבות ==\nישן\nתגובה חדשה', 'existing'],
    ['', '== חשיבות: ערך ==\n', 'existing'],
    ['', '== מדוע הערך כאן? ==\nאיני רואה חשיבות', 'existing'],
    ['', '== מדוע הערך כאן? ==\nנא להסביר', 'uncertain'],
    ['', 'נא להסביר', 'uncertain'],
    ['מבוא', 'מבוא  \n', 'none'],
    ['== כותרת ==\nטקסט', `== כותרת ==\nטקסט\n${template}`, 'existing'],
    ['== כותרת ==\nטקסט', `${template}\n== כותרת ==\nטקסט`, 'none'],
  ])('classifies changes %#', (before, after, expected) => {
    expect(assessDiscussion(before, after, title)).toBe(expected);
  });

  it.each([undefined, '', '6.10.2026', '06.10.2026'])('accepts matching or absent template date %s', (date) => {
    expect(matchesPlacementDate(date, placedAt)).toBe(true);
  });

  it.each(['1.9.2026', '{{תאריך}}', '7.10.2026'])('rejects conflicting or unresolved template date %s', (date) => {
    expect(matchesPlacementDate(date, placedAt)).toBe(false);
  });

  it('uses the placement date in Israel, identifies the edit and signs as the bot', () => {
    const text = discussionMessage(title, 'בודק', '2026-10-06T22:30:00Z', 20);

    expect(text).toContain('7.10.2026');
    expect(text).toContain('[[משתמש:בודק]]');
    expect(text).toContain('[[מיוחד:הבדל/20|');
    expect(text).toContain('importance-discussion:20');
    expect(text).toContain('~~~~');
  });
});

describe('daily importance discussions', () => {
  let api: ReturnType<typeof WikiApiMock>;
  let pages: Record<string, any>;
  let histories: Revision[][];
  let baseline: any;
  let candidates: WikiPage[][];
  let storedRevid: number;
  const errorSpy = jest.spyOn(logger, 'logError').mockImplementation(() => {});
  const warningSpy = jest.spyOn(logger, 'logWarning').mockImplementation(() => {});
  const infoSpy = jest.spyOn(logger, 'logInfo').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    api = WikiApiMock();
    pages = { [stateTitle]: { missing: '' }, [title]: page(template), [talkTitle]: page('', 10, 2) };
    histories = [[revision(), revision('תוכן הערך', 19)]];
    baseline = {};
    candidates = [[candidate()]];
    storedRevid = 100;
    api.getPage.mockImplementation(async (pageTitle, revisionAt) => (revisionAt ? baseline : pages[pageTitle]));
    api.getArticlesWithTemplate.mockImplementation(async function* getPages(name) {
      if (name === 'הבהרת חשיבות עם זמן') yield* candidates;
    });
    api.getArticleRevisions.mockImplementation(async function* getHistory() {
      yield* histories;
    });
    const write = async (pageTitle: string, _summary: string, content: string) => {
      storedRevid += 1;
      pages[pageTitle] = page(content, storedRevid);
      return {
        edit: {
          result: 'Success', newrevid: storedRevid, pageid: 2, title: pageTitle, contentmodel: 'wikitext',
        },
      };
    };
    api.edit.mockImplementation(write);
    api.create.mockImplementation(write);
  });

  afterEach(() => { jest.useRealTimers(); });

  const run = (dryRun = false) => ImportanceDiscussionsModel(api, { stateTitle, now, dryRun }).run();
  const talkEdits = () => api.edit.mock.calls.filter(([pageTitle]) => pageTitle === talkTitle);

  it('opens a signed section, preserves the page and claims before editing', async () => {
    pages[talkTitle] = page('מבוא\n== ישן ==\nדיון קודם', 10);
    baseline = pages[talkTitle];
    await run();

    expect(talkEdits()).toStrictEqual([[talkTitle, expect.any(String),
      expect.stringContaining('מבוא\n== ישן ==\nדיון קודם\n\n== חשיבות: ערך לדוגמה =='), 10]]);
    expect(api.create.mock.calls[0][2]).toContain('"ערך לדוגמה:20": "pending"');
    expect(api.create.mock.invocationCallOrder[0]).toBeLessThan(api.edit.mock.invocationCallOrder[0]);
    expect(pages[stateTitle].revisions[0].slots.main['*']).toContain('"ערך לדוגמה:20": "done"');

    expect(api.getPage).toHaveBeenCalledWith(talkTitle, new Date('2026-10-05T10:00:00.000Z'));
  });

  it('creates a missing talk page with create-only semantics', async () => {
    pages[talkTitle] = { missing: '' };
    await run();

    expect(api.create).toHaveBeenCalledWith(talkTitle, expect.any(String), expect.stringContaining('== חשיבות:'));
    expect(talkEdits()).toHaveLength(0);
  });

  it('supports a template placed in the lead of an article talk page', async () => {
    candidates = [[candidate(talkTitle, 1)]];
    pages[talkTitle] = page(template);
    await run();

    expect(talkEdits()[0][2]).toContain(`${template}\n\n== חשיבות: ${title} ==`);
  });

  it('deduplicates template query pages and daily runs even after message deletion', async () => {
    candidates = [[candidate(), candidate(title, 0, 99)], [candidate(title, 0, 100)]];
    await run();
    pages[talkTitle] = page('', 200);
    await run();

    expect(talkEdits()).toHaveLength(1);
  });

  it('reports dry-run candidates without editing state or talk pages', async () => {
    await run(true);

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(talkTitle));
    expect(api.edit).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('keeps separate titles distinct even when candidate page IDs match', async () => {
    const otherTitle = 'ערך נוסף';
    candidates = [[candidate(), candidate(otherTitle)]];
    pages[otherTitle] = page(template);
    pages[`שיחה:${otherTitle}`] = { missing: '' };
    await run();

    expect(JSON.parse(pages[stateTitle].revisions[0].slots.main['*'])).toStrictEqual({
      [`${title}:20`]: 'done', [`${otherTitle}:20`]: 'done',
    });
    expect(api.create).toHaveBeenCalledWith(`שיחה:${otherTitle}`, expect.any(String), expect.any(String));
  });

  it.each([[false, 1], [true, 0]] as const)('recognizes manual discussion (dryRun=%s)', async (dryRun, writes) => {
    pages[talkTitle] = page('== חשיבות ==\nנימוק', 10);
    await run(dryRun);

    expect(talkEdits()).toHaveLength(0);
    expect(api.create).toHaveBeenCalledTimes(writes);
  });

  it('recognizes a bot marker without a standard title', async () => {
    pages[talkTitle] = page('<!-- importance-discussion:20 -->', 10);
    await run();

    expect(talkEdits()).toHaveLength(0);
    expect(pages[stateTitle].revisions[0].slots.main['*']).toContain('done');
  });

  it('leaves ambiguous discussions for manual review', async () => {
    pages[talkTitle] = page('== למה? ==\nהסבר בבקשה', 10);
    await run();

    expect(talkEdits()).toHaveLength(0);
    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('Possible existing'));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('allows a new discussion alongside an unchanged old importance discussion', async () => {
    pages[talkTitle] = page('== חשיבות ==\nדיון מ־2020', 10);
    baseline = pages[talkTitle];
    await run();

    expect(talkEdits()).toHaveLength(1);
  });

  it.each(['', '[]', 'null', '123', '{"ערך לדוגמה:20":"bad"}'])('fails closed on invalid state %s', async (content) => {
    pages[stateTitle] = page(content);

    await expect(run()).rejects.toThrow(/Invalid importance|JSON/);
    expect(api.getArticlesWithTemplate).not.toHaveBeenCalled();
  });

  it('does not reopen a pending case after an uncertain previous write', async () => {
    pages[stateTitle] = page('{"ערך לדוגמה:20":"pending"}');
    await run();

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('Uncertain previous'));
    expect(talkEdits()).toHaveLength(0);
  });

  it.each([['', 0], ['{{חשיבות|סוג=שחזור}}', 0], ['{{חשיבות}}{{הבהרת חשיבות}}', 0], ['{{חשיבות}}', 1]] as const)('handles template variants conservatively: %s', async (content, writes) => {
    pages[title] = page(content);
    await run();

    expect(talkEdits()).toHaveLength(writes);
  });

  it.each(['{{חשיבות|זמן=1.9.2026}}', '{{הבהרת חשיבות עם זמן|1.9.2026|זמן=6.10.2026}}'])('does not restart a restored template with an older date: %s', async (content) => {
    pages[title] = page(content);
    await run();

    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('Template date differs'));
    expect(api.create).not.toHaveBeenCalled();
    expect(talkEdits()).toHaveLength(0);
  });

  it('supports legacy positional dates', async () => {
    pages[title] = page('{{הבהרת חשיבות עם זמן|06.10.2026}}');
    await run();

    expect(talkEdits()).toHaveLength(1);
  });

  it('skips a deleted source page', async () => {
    pages[title] = { missing: '' };
    await run();

    expect(api.getArticleRevisions).not.toHaveBeenCalled();
  });

  it.each([{}, { redirect: '' }, { revisions: [{}] }, { revisions: [{ revid: 1 }] },
    { revisions: [{ revid: 1, slots: {} }] }])('skips unreadable or redirected talk pages: %j', async (value) => {
    pages[talkTitle] = value;
    await run();

    expect(errorSpy).toHaveBeenCalledWith(expect.any(String));
    expect(talkEdits()).toHaveLength(0);
  });

  it.each([{ revisions: [{}] }, { revisions: [{ slots: {} }] }, { revisions: [{ slots: { main: {} } }] }])('skips suppressed talk history: %j', async (value) => {
    baseline = value;
    await run();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unreadable talk history'));
    expect(talkEdits()).toHaveLength(0);
  });

  it.each([
    { items: [revision(template, 21), revision('', 19)] },
    { items: [revision('', 20)] },
    { items: [revision(template, 20, '2026-09-01T10:00:00Z')] },
    { items: [revision(template, 20, 'invalid')] },
    { items: [revision(template, 20, '2026-10-07T09:45:00Z'), revision('', 19)] },
    { items: [revision(template, 20, '2026-10-08T09:45:00Z'), revision('', 19)] },
  ])('does not edit for changed, stale or too recent placement %#', async ({ items }) => {
    histories = [items];
    await run();

    expect(talkEdits()).toHaveLength(0);
  });

  it.each([
    { ...revision(), revid: undefined }, { ...revision(), timestamp: undefined },
    { ...revision(), slots: undefined }, { ...revision(), user: '' },
    { ...revision(), slots: {} }, { ...revision(), slots: { main: {} } },
  ])('skips incomplete source history %#', async (value) => {
    histories = [[value as Revision]];
    await run();

    expect(errorSpy).toHaveBeenCalledWith(expect.any(String));
    expect(talkEdits()).toHaveLength(0);
  });

  it('does not guess placement when history ends without a boundary', async () => {
    histories = [[revision()]];
    await run();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not establish'));
    expect(talkEdits()).toHaveLength(0);
  });

  it('recognizes a page created with the template', async () => {
    histories = [[{ ...revision(), parentid: 0 } as Revision]];
    await run();

    expect(talkEdits()).toHaveLength(1);
  });

  it('finds the original placer across history batches', async () => {
    histories = [[revision(template, 20, placedAt, 'עורך מאוחר')], [revision(template, 19)], [revision('', 18)]];
    await run();

    expect(talkEdits()[0][2]).toContain('[[משתמש:בודק]]');
    expect(talkEdits()[0][2]).toContain('importance-discussion:19');
  });

  it('bounds history scanning', async () => {
    histories = [Array.from({ length: 501 }, (_, index) => revision(template, 20 + index))];
    await run();

    expect(talkEdits()).toHaveLength(0);
  });

  function changePageOnSecondRead(changedTitle: string) {
    let reads = 0;
    api.getPage.mockImplementation(async (pageTitle, revisionAt) => {
      if (pageTitle === changedTitle && !revisionAt) {
        reads += 1;
        if (reads === 2) return { ...pages[pageTitle], ...page(changedTitle === title ? '' : 'נפתח דיון', 99) };
      }
      return revisionAt ? baseline : pages[pageTitle];
    });
  }

  it.each([title, talkTitle])('rechecks %s before writing', async (changedTitle) => {
    changePageOnSecondRead(changedTitle);
    await run();

    expect(api.create).not.toHaveBeenCalled();
    expect(talkEdits()).toHaveLength(0);
  });

  it.each([undefined, {}, { edit: { result: 'Failure' } }, { edit: { result: 'Success' } }])('does not edit if the state claim fails: %j', async (value) => {
    api.create.mockResolvedValue(value);
    await run();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist'));
    expect(talkEdits()).toHaveLength(0);
  });

  it('does not overwrite state after a competing update', async () => {
    pages[stateTitle] = page('{}', 90);
    api.edit.mockRejectedValue(new Error('editconflict'));
    await run();

    expect(api.edit).toHaveBeenCalledWith(stateTitle, expect.any(String), expect.any(String), 90);
    expect(talkEdits()).toHaveLength(0);
  });

  function failTalkWrite(failure: string) {
    api.edit.mockImplementation(async () => {
      if (failure === 'throw') throw new Error('editconflict');
      return (failure === 'unconfirmed' ? undefined : {}) as any;
    });
  }

  it.each(['throw', 'unconfirmed', 'missing-edit'])('retains pending after %s', async (failure) => {
    failTalkWrite(failure);
    await run();
    await run();

    expect(talkEdits()).toHaveLength(1);
    expect(pages[stateTitle].revisions[0].slots.main['*']).toContain('pending');
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String));
  });

  it('continues after a page fails', async () => {
    candidates = [[candidate('חסר', 0, 9), candidate()]];
    pages['חסר'] = {};
    await run();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(talkEdits()).toHaveLength(1);
  });

  it('uses the current clock by default', async () => {
    jest.useFakeTimers().setSystemTime(now);
    await ImportanceDiscussionsModel(api, { stateTitle, dryRun: true }).run();

    expect(infoSpy).toHaveBeenCalledWith(expect.any(String));
  });
});
