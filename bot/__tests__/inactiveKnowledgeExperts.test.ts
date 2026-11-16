import {
  afterEach, describe, expect, it, jest,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { WikiPage, UserContribution } from '../types';
import runInactiveKnowledgeExperts from '../maintenance/inactiveKnowledgeExperts/model';
import {
  listKnowledgeExperts, parseMembers, withoutMember,
} from '../maintenance/inactiveKnowledgeExperts/memberships';

const css = 'תבנית:בעלי ידע/CSS';
const html = 'תבנית:בעלי ידע/HTML';
const js = 'תבנית:בעלי ידע/JS';
const aliceTalk = 'שיחת משתמש:Alice';
const wikiUsername = 'Authenticated account';
const logTitle = 'ויקיפדיה:בוט/ניקוי בעלי ידע לא פעילים';
const warningLogSummary = 'רישום התראה ביומן הבוט';
const removalLogSummary = 'רישום הסרה ביומן הבוט';
const category = '<noinclude>[[קטגוריה:ויקיפדיה: בעלי ידע במחשבים]]</noinclude>';
const closeSummary = 'עדכון בנוגע לרשימות בעלי הידע';
const createApi = jest.fn<() => ReturnType<typeof WikiApiMock>>();
jest.unstable_mockModule('../wiki/WikiApi', () => ({ default: createApi }));
const { main, default: runHandler } = await import('../maintenance/inactiveKnowledgeExperts/index');

function makePage(title: string, content: string, revid = 1, user = 'Human', comment = ''): WikiPage {
  return {
    pageid: revid,
    ns: 0,
    title,
    extlinks: [],
    revisions: [{
      revid,
      user,
      comment,
      size: content.length,
      slots: { main: { '*': content, contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
    }],
  };
}

function wiki() {
  const api = WikiApiMock();
  const history = new Map<string, WikiPage[]>();
  const active = new Set<string>();
  const unregistered = new Set<string>();
  const registrations = new Map<string, string>();
  const hidden = new Set<string>();
  const redirects = new Set<string>();
  const failures = new Map<string, 'throw' | 'rejected' | 'committed' | 'nochange'>();
  const failEdit = (key: string, mode: 'throw' | 'rejected' | 'committed' | 'nochange' = 'throw') => failures.set(key, mode);
  let revision = 0;

  function put(title: string, content: string, user = 'Human', summary = '') {
    const page = makePage(title, content, revision + 1, user, summary);
    revision += 1;
    history.set(title, [page, ...(history.get(title) ?? [])]);
    return page;
  }

  const pageFor = (title: string) => history.get(title)?.[0] ?? { ...makePage(title, ''), missing: '' };
  const contentOf = (title: string) => pageFor(title).revisions?.[0].slots.main['*'];
  const write = (title: string, summary: string, content: string) => {
    const key = failures.has(title) ? title : summary.split(' (')[0];
    const failure = failures.get(key);
    failures.delete(key);
    if (failure === 'throw') throw new Error('Edit failed before commit');
    if (failure === 'nochange') {
      const page = pageFor(title);
      return {
        edit: {
          result: 'Success', oldrevid: page.pageid, pageid: page.pageid, title, contentmodel: 'wikitext',
        },
      };
    }
    const page = put(title, content, wikiUsername, summary);
    if (failure === 'committed') throw new Error('Edit response lost');
    const result = failure === 'rejected' ? 'Failure' : 'Success';
    return {
      edit: {
        result, newrevid: page.pageid, pageid: page.pageid, title, contentmodel: 'wikitext',
      },
    };
  };

  api.getAuthenticatedUsername.mockResolvedValue(wikiUsername);
  api.getPage.mockImplementation(async (title) => {
    const page = pageFor(title);
    if (hidden.has(title)) return { ...page, revisions: undefined };
    if (redirects.has(title)) return { ...page, redirect: '' };
    return page;
  });
  api.getArticleRevisions.mockImplementation(async function* getRevisions(title) {
    yield (history.get(title) ?? []).flatMap((page) => page.revisions ?? []);
  });
  api.allPages.mockImplementation(async function* listPages() {
    yield [...history.keys()].filter((title) => title.startsWith('תבנית:בעלי ידע/'))
      .map(pageFor);
  });
  api.registeredUsers.mockImplementation(async (names) => names.filter((name) => !unregistered.has(name))
    .map((name) => ({ name, registration: registrations.get(name) ?? null })));
  api.userContributes.mockImplementation(async function* contributions(name) {
    yield active.has(name) ? [{ title: 'Article' } as UserContribution] : [];
  });
  api.create.mockImplementation(async (title, summary, content) => {
    if (pageFor(title).missing === undefined) throw new Error('Page already created');
    return write(title, summary, content);
  });
  api.edit.mockImplementation(async (title, summary, content, revid) => {
    if (pageFor(title).revisions?.[0].revid !== revid) throw new Error('Edit conflict');
    return write(title, summary, content);
  });
  const contentWrites = () => [...api.edit.mock.calls, ...api.create.mock.calls]
    .filter(([title]) => title !== logTitle).length;
  const run = (date: string, dryRun = false) => {
    const now = new Date(date);
    return runInactiveKnowledgeExperts(api, { wikiUsername, now, dryRun });
  };

  return {
    api, active, hidden, redirects, unregistered, registrations, put, contentOf, contentWrites, run, failEdit,
  };
}

describe('knowledge-expert membership syntax', () => {
  it('matches only transcluded user links, mentions and group mentions', () => {
    const source = '<noinclude>{{א|Example}}</noinclude>{{א|1=alice_s|display}}, '
      + '[[משתמשת:דנה]], [[User:CaseSensitive]], {{@@|Bob|Carol}}\n'
      + '<!--{{א|Comment}}--><nowiki class="x">{{א|Sample}}</nowiki>\n'
      + '{{#שווה:{{יום מקומי}}|6||{{א|Sunday}}}} {{other|[[משתמש:Nesting]]}}\n'
      + '{{@@|1=Named}} [[משתמש:Root/Sandbox]] [[מש:Short]] [[CSS]] {{א| }} [https://example.test link]';

    expect(parseMembers(source).map(({ username }) => username)).toStrictEqual([
      'Alice s', 'דנה', 'CaseSensitive', 'Bob', 'Carol', 'Sunday', 'Short',
    ]);
  });

  it('preserves unrelated text and detects duplicate membership', () => {
    expect([
      withoutMember('{{א|Alice}}, {{א|Bob}}', 'Alice'),
      withoutMember('{{א|Bob}}, {{א|Alice}} (הערה)\n<!-- comment -->', 'Alice'),
      withoutMember('{{א|Bob}} ו־{{א|Alice}}', 'Alice'),
      withoutMember('{{@@|Bob|Alice|Carol}}', 'Alice'),
      withoutMember('{{@@|Alice}}', 'Alice'),
      withoutMember('{{א|AliceB}} {{א|ALICE}}', 'Alice'),
    ]).toStrictEqual([
      '{{א|Bob}}', '{{א|Bob}}\n<!-- comment -->', '{{א|Bob}}', '{{@@|Bob|Carol}}', '', undefined,
    ]);
    expect(() => withoutMember('[[משתמש:Alice]], {{א|Alice}}', 'Alice')).toThrow('Ambiguous');
  });

  it('uses every batch and excludes example and auxiliary templates', async () => {
    const { api } = wiki();
    api.allPages.mockImplementation(async function* listPages() {
      yield [makePage('תבנית:בעלי ידע/תיעוד', '{{א|Example}}'), makePage(css, `{{א|Alice}}${category}`)];
      yield [makePage(html, `{{@@|Alice|Bob}}${category}`)];
    });

    await expect(listKnowledgeExperts(api)).resolves.toStrictEqual(new Map([
      ['Alice', [css, html]], ['Bob', [html]],
    ]));
    expect(api.allPages).toHaveBeenCalledWith(10, '', 'בעלי ידע/');

    api.allPages.mockImplementation(async function* listPages() {
      yield [{ ...makePage(css, ''), revisions: undefined }];
    });

    await expect(listKnowledgeExperts(api)).rejects.toThrow('Missing template content');
  });
});

describe('the monthly cleanup', () => {
  it('plans a warning without wiki edits by default, and ignores active and unregistered users', async () => {
    const {
      api, put, active, unregistered, registrations,
    } = wiki();
    put(css, `{{א|Alice}}, {{א|Active}}, {{א|Renamed}}, {{א|New}}${category}`);
    active.add('Active');
    unregistered.add('Renamed');
    registrations.set('New', new Date().toISOString());
    registrations.set('Alice', '2012-08-01T12:00:00Z');

    await expect(runInactiveKnowledgeExperts(api, { wikiUsername })).resolves.toMatchObject({
      dryRun: true, warned: ['Alice'], skipped: ['Active', 'Renamed', 'New'],
    });
    expect(api.edit).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('warns once and waits a full month before removing only warned memberships', async () => {
    const {
      contentWrites, put, contentOf, run, active,
    } = wiki();
    active.add('Bob');
    put(css, `[[משתמש:Alice]], {{א|Bob}}${category}`);
    put(html, `{{@@|Bob|Alice}}${category}`);
    put(aliceTalk, 'Earlier discussion');
    const first = await run('2026-09-04T08:00Z');

    expect(first.warned).toStrictEqual(['Alice']);
    expect(contentOf(aliceTalk)).toContain(`* [[${html}]]`);

    put(aliceTalk, `${contentOf(aliceTalk)}\n== Another discussion ==\nKeep this.`);
    put(js, `{{א|Alice}}${category}`);
    const writes = contentWrites();
    await run('2026-09-04T08:10Z');
    await run('2026-10-02T08:00Z');

    expect(contentWrites()).toBe(writes);

    const due = await run('2026-10-04T08:00Z');
    const talk = contentOf(aliceTalk) as string;
    const finalWrites = contentWrites();
    await run('2026-10-04T09:00Z');

    expect({
      removed: due.removed,
      css: contentOf(css),
      html: contentOf(html),
      js: contentOf(js),
      reply: talk.split('== Another discussion ==')[0],
      writes: contentWrites(),
    }).toMatchObject({
      removed: ['Alice'],
      css: `{{א|Bob}}${category}`,
      html: `{{@@|Bob}}${category}`,
      js: `{{א|Alice}}${category}`,
      reply: expect.stringContaining(`[[${html}|HTML]]`),
      writes: finalWrites,
    });
  });

  it('closes a notice for a returning editor without touching the topic', async () => {
    const {
      put, contentOf, run, active, api,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-08-01T08:00Z');
    active.add('Alice');
    const repeat = await run('2026-08-02T08:00Z');

    expect(repeat.skipped).toStrictEqual(['Alice']);

    const next = await run('2026-09-01T08:00Z');

    expect(next.closed).toStrictEqual(['Alice']);
    expect(contentOf(aliceTalk)).toContain('תודה על חזרתך לפעילות');
    expect(api.edit.mock.calls.some(([title]) => title === css)).toBe(false);
  });

  it('retries a failed warning, and does not repost one archived during the same month', async () => {
    const {
      failEdit, put, contentOf, run,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    put(aliceTalk, '');
    failEdit(aliceTalk);

    expect((await run('2026-09-01T08:00Z')).failed).toStrictEqual(['Alice']);
    expect(contentOf(aliceTalk)).toBe('');
    expect((await run('2026-09-02T08:00Z')).warned).toStrictEqual(['Alice']);

    put(aliceTalk, 'Archived');

    const sameMonth = await run('2026-09-04T08:00Z');

    expect({ skipped: sameMonth.skipped, talk: contentOf(aliceTalk) })
      .toStrictEqual({ skipped: ['Alice'], talk: 'Archived' });

    const nextMonth = await run('2026-10-04T08:00Z');

    expect({ warned: nextMonth.warned, topic: contentOf(css) })
      .toStrictEqual({ warned: ['Alice'], topic: `{{א|Alice}}${category}` });
  });

  it('recognizes a follow-up edit after a partial failure even when the last membership is gone', async () => {
    const {
      api, failEdit, put, contentOf, run,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    failEdit(closeSummary);

    expect((await run('2026-10-01T08:00Z')).failed).toStrictEqual(['Alice']);
    expect(contentOf(css)).toBe(category);
    expect((await run('2026-10-02T08:00Z')).removed).toStrictEqual(['Alice']);

    const repeat = await run('2026-10-04T08:00Z');

    expect({
      talk: contentOf(aliceTalk),
      edits: api.edit.mock.calls.filter(([title]) => title === css).length,
      repeat: repeat.removed,
    }).toMatchObject({ talk: expect.stringContaining(`[[${css}|CSS]]`), edits: 1, repeat: [] });
  });

  it('does not remove a re-added membership while resuming a partially completed removal', async () => {
    const {
      failEdit, put, contentOf, run,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    put(html, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    failEdit(html);

    expect((await run('2026-10-01T08:00Z')).failed).toStrictEqual(['Alice']);

    put(css, `{{א|Alice}}${category}`);
    put(html, `{{א|Alice}}, <!-- human change -->{{א|Bob}}${category}`);

    expect((await run('2026-10-02T08:00Z')).removed).toStrictEqual(['Alice']);
    expect([contentOf(css), contentOf(html)]).toStrictEqual([
      `{{א|Alice}}${category}`, `<!-- human change -->{{א|Bob}}${category}`,
    ]);

    const reply = contentOf(aliceTalk)?.split('שמך הוסר')[1];

    expect(reply).toContain('HTML');
    expect(reply).not.toContain('CSS');
  });

  it('continues processing other users when a membership is ambiguous', async () => {
    const {
      put, contentOf, run, active,
    } = wiki();
    put(css, `{{א|Alice}}, [[משתמש:Alice]], {{א|Bob}}${category}`);
    put(html, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    active.add('Bob');
    const report = await run('2026-10-01T08:00Z');

    expect(report).toMatchObject({ failed: ['Alice'], closed: ['Bob'] });
    expect(contentOf(html)).toContain('{{א|Alice}}');
  });

  it('refuses to use a run log written by another editor or with malformed records', async () => {
    const { put, run, contentOf } = wiki();
    await run('2026-11-01T08:00Z');
    const log = contentOf(logTitle);
    put(logTitle, `${log}Edited by another user.`);

    await expect(run('2026-11-02T08:00Z')).rejects.toThrow('Untrusted cleanup log');

    const line = '["Alice",{"warnedOn":"2026-10-01","topics":["Article"]}]';
    put(logTitle, `${log}<!-- knowledge-experts: ${line} -->\n`, wikiUsername);

    await expect(run('2026-11-02T08:00Z')).rejects.toThrow('Invalid cleanup entry');

    put(logTitle, `${log}<!-- knowledge-experts: {} -->\n`, wikiUsername);

    await expect(run('2026-11-02T08:00Z')).rejects.toThrow('Invalid cleanup entry');
  });
});

describe('recovery and source validation', () => {
  it('previews removal without even editing the tracking page', async () => {
    const {
      api, put, run, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-08-01T08:00Z');
    api.edit.mockClear();
    api.create.mockClear();

    await expect(run('2026-09-01T08:00Z', true)).resolves.toMatchObject({
      dryRun: true, removed: ['Alice'],
    });
    expect(api.edit).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    expect(contentOf(css)).toContain('{{א|Alice}}');
  });

  it('recovers a reply whose acknowledgement was lost and then archived', async () => {
    const {
      failEdit, put, run, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    put(aliceTalk, 'Old talk');
    await run('2026-09-01T08:00Z');
    failEdit(closeSummary, 'committed');

    expect((await run('2026-10-01T08:00Z')).failed).toStrictEqual(['Alice']);

    put(aliceTalk, 'Archived after successful reply');
    const repeat = await run('2026-10-02T08:00Z');

    expect(repeat.skipped).toStrictEqual(['Alice']);
    expect(contentOf(aliceTalk)).toBe('Archived after successful reply');
  });

  it('does not repeat a reply that succeeded despite a network error', async () => {
    const { failEdit, put, run } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    failEdit(closeSummary, 'committed');

    expect((await run('2026-10-01T08:00Z')).failed).toStrictEqual(['Alice']);
    expect((await run('2026-10-02T08:00Z')).skipped).toStrictEqual(['Alice']);
  });

  it('reports already completed removals if the user returns and the original notice is archived', async () => {
    const {
      failEdit, put, run, active, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    put(html, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    failEdit(html);
    await run('2026-10-01T08:00Z');

    put(aliceTalk, 'Archived');
    active.add('Alice');
    const repeat = await run('2026-10-02T08:00Z');

    expect(repeat.removed).toStrictEqual(['Alice']);
    expect(contentOf(aliceTalk)).toContain('תודה על חזרתך לפעילות');
    expect(contentOf(html)).toContain('{{א|Alice}}');
  });

  it('closes earlier warnings if registrations disappear', async () => {
    const {
      put, run, unregistered, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}, {{א|Bob}}, {{א|Carol}}${category}`);
    await run('2026-09-01T08:00Z');
    put(aliceTalk, 'Notice removed');
    put(css, 'Former topic');
    unregistered.add('Carol');

    const result = await run('2026-10-01T08:00Z');

    expect(result).toMatchObject({ skipped: ['Alice', 'Carol'], closed: ['Bob'] });
    expect(contentOf(css)).toBe('Former topic');
  });

  it('never edits a redirect or a page whose source is unreadable', async () => {
    const {
      put, run, redirects, hidden, api,
    } = wiki();
    put(css, `{{א|Alice}}, {{א|Bob}}${category}`);
    await run('2026-09-01T08:00Z');
    redirects.add(css);
    hidden.add(aliceTalk);
    const report = await run('2026-10-01T08:00Z');

    expect(report).toMatchObject({ failed: ['Alice'], closed: ['Bob'] });
    expect(api.edit.mock.calls.filter(([title]) => title === css)).toHaveLength(0);
  });

  it('closes an archived warning without posting a separate cancellation for an active user', async () => {
    const {
      put, run, active, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    put(aliceTalk, 'Archived');
    active.add('Alice');
    const result = await run('2026-10-01T08:00Z');

    expect(result.closed).toStrictEqual(['Alice']);
    expect(contentOf(aliceTalk)).toBe('Archived');
  });

  it('keeps the base revision from a no-change state edit on a same-day retry', async () => {
    const {
      put, run, failEdit, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    failEdit(aliceTalk);
    await run('2026-09-01T08:00Z');
    failEdit('עדכון מעקב אחר תחזוקת בעלי הידע', 'nochange');

    expect((await run('2026-09-01T09:00Z')).warned).toStrictEqual(['Alice']);
    expect((await run('2026-10-01T08:00Z')).removed).toStrictEqual(['Alice']);
    expect(contentOf(css)).toBe(category);
  });

  it('handles a topic disappearing or being manually cleared after a partial write', async () => {
    const {
      put, run, failEdit, redirects, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    put(html, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    failEdit(css);
    await run('2026-10-01T08:00Z');
    redirects.add(css);
    put(html, `{{א|Bob}}${category}`);
    const result = await run('2026-10-02T08:00Z');

    expect(result.closed).toContain('Alice');
    expect(contentOf(aliceTalk)).not.toContain('שמך הוסר');
  });

  it('does not remove a member based on a warning marker added by somebody else', async () => {
    const {
      put, run, failEdit, contentOf,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    failEdit(aliceTalk);
    await run('2026-09-01T08:00Z');
    put(aliceTalk, '== רשימות בעלי הידע ==\n<!-- Sapper-bot:knowledge-expert:v2:2026-09-01 -->\n');
    const result = await run('2026-10-01T08:00Z');

    expect(result.failed).toStrictEqual(['Alice']);
    expect(contentOf(css)).toContain('{{א|Alice}}');
  });

  it('treats an unsuccessful MediaWiki edit response as a failure', async () => {
    const {
      put, run, failEdit,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    failEdit(aliceTalk, 'rejected');

    expect((await run('2026-09-01T08:00Z')).failed).toStrictEqual(['Alice']);
  });
});

describe('the public run log', () => {
  it('keeps a dated section for every live run and logs signed notifications and removals once', async () => {
    const { put, run, contentOf } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');

    expect(contentOf(aliceTalk)).toContain('~~~~');

    await run('2026-09-02T08:00Z');
    await run('2026-10-01T08:00Z');
    const talk = contentOf(aliceTalk);
    const entries = contentOf(logTitle)?.split(/^== .* ==$/m);

    expect(talk?.match(/~~~~/g)).toHaveLength(2);
    expect(entries).toStrictEqual([
      expect.stringContaining('זמני הריצות מוצגים לפי שעון ישראל'),
      expect.stringContaining('* נשלחה התראה ל[[שיחת משתמש:Alice|Alice]].'),
      expect.stringContaining('לא תועדו התראות או הסרות'),
      expect.stringContaining(`* [[משתמש:Alice|Alice]] הוסר מרשימת [[${css}|CSS]].`),
    ]);
    expect(contentOf(logTitle)).toContain('== 2026-09-01 11:00:00 ==');
  });

  it('recovers a delivered warning after the talk page was archived and the log edit failed', async () => {
    const {
      put, run, contentOf, failEdit,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    failEdit(warningLogSummary);
    const first = await run('2026-09-01T08:00Z');

    expect(first.failed).toStrictEqual(['Alice']);
    expect(contentOf(logTitle)).not.toContain('* נשלחה התראה');

    put(aliceTalk, 'Archived after delivery');
    const repeat = await run('2026-09-02T08:00Z');

    expect(repeat.skipped).toStrictEqual(['Alice']);
    expect(contentOf(aliceTalk)).toBe('Archived after delivery');
    expect(contentOf(logTitle)).toContain(
      '* נשלחה התראה ל[[שיחת משתמש:Alice|Alice]]. הפעולה בוצעה בריצה קודמת',
    );
  });

  it('logs an interrupted removal exactly once even if the user was re-added before recovery', async () => {
    const {
      put, run, contentOf, failEdit,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    failEdit(removalLogSummary);
    const first = await run('2026-10-01T08:00Z');

    expect(first.failed).toStrictEqual(['Alice']);
    expect(contentOf(css)).toBe(category);

    put(css, `{{א|Alice}}${category}`);
    await run('2026-10-02T08:00Z');
    await run('2026-10-04T08:00Z');
    const log = contentOf(logTitle);

    expect(contentOf(css)).toContain('{{א|Alice}}');
    expect(log?.match(/הוסר מרשימת/g)).toHaveLength(1);
    expect(log).toContain(`[[${css}|CSS]]. הפעולה בוצעה בריצה קודמת`);
  });

  it('retains the removal entry when sending the reply fails and a later run sends it', async () => {
    const {
      put, run, contentOf, failEdit,
    } = wiki();
    put(css, `{{א|Alice}}${category}`);
    await run('2026-09-01T08:00Z');
    failEdit(closeSummary);
    await run('2026-10-01T08:00Z');

    expect(contentOf(logTitle)).toContain(`* [[משתמש:Alice|Alice]] הוסר מרשימת [[${css}|CSS]].`);

    await run('2026-10-02T08:00Z');

    expect(contentOf(logTitle)?.match(/הוסר מרשימת/g)).toHaveLength(1);
    expect(contentOf(aliceTalk)).toContain('שמך הוסר');
  });
});

describe('scheduled handler', () => {
  afterEach(() => {
    jest.useRealTimers();
    delete process.env.INACTIVE_KNOWLEDGE_EXPERTS_WRITE_ENABLED;
  });

  it('checks the dry-run switch and skips all activity on Shabbat', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-14T08:00Z') });
    const { api, put } = wiki();
    put(css, `{{א|Alice}}${category}`);
    createApi.mockReturnValue(api);
    createApi.mockClear();

    await expect(main()).resolves.toBeUndefined();

    expect(createApi).not.toHaveBeenCalled();

    jest.setSystemTime(new Date('2026-11-15T08:00Z'));

    await expect(main()).resolves.toMatchObject({ dryRun: true, warned: ['Alice'] });
    await expect(runHandler()).resolves.toMatchObject({ dryRun: true });
    expect(api.create).not.toHaveBeenCalled();
  });

  it('enables writes only with explicit configuration and recognizes log entries by the authenticated account', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-15T08:00Z') });
    process.env.INACTIVE_KNOWLEDGE_EXPERTS_WRITE_ENABLED = 'true';
    const { api, put } = wiki();
    put(css, `{{א|Alice}}${category}`);
    createApi.mockReturnValue(api);

    await expect(main()).resolves.toMatchObject({ dryRun: false, warned: ['Alice'] });
    expect(api.create).toHaveBeenCalledTimes(2);

    jest.setSystemTime(new Date('2026-11-16T08:00Z'));

    await expect(main()).resolves.toMatchObject({ dryRun: false, skipped: ['Alice'], failed: [] });
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});
