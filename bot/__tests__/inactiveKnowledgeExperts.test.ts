import {
  describe, expect, it,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import runInactiveKnowledgeExperts, {
  closeWarning, formerExpertTemplates, listKnowledgeExperts, parseMembers,
  pendingWarning, removeMember, warningMessage,
} from '../maintenance/inactiveKnowledgeExperts/model';

const now = new Date('2026-12-10T09:00:00Z');
const css = 'תבנית:בעלי ידע/CSS';
const html = 'תבנית:בעלי ידע/HTML';

function page(title: string, content: string) {
  return {
    title,
    revisions: [{ revid: 10, slots: { main: { '*': content } } }],
  } as any;
}

function mockWiki(talk = '', content = '{{א|1Or}}, [[משתמשת:דנה]], [[משתמש:פעיל]]') {
  const api = WikiApiMock();
  api.allPages.mockImplementation(async function* pages() {
    yield [page(css, content), page(html, '[[משתמש:1Or]]')];
    yield [page('תבנית:בעלי יכולת', '[[משתמש:Other]]')];
  });
  api.articleContent.mockImplementation(async (title) => {
    if (title === css) return { content, revid: 25 };
    if (title === html) return { content: '[[משתמש:1Or]]', revid: 26 };
    return { content: talk, revid: 27 };
  });
  api.info.mockResolvedValue([{ title: 'Page', pageid: 3 }]);
  api.userContributes.mockImplementation(async function* noContributions() {
    yield [];
  });
  return api;
}

describe('inactive knowledge experts cleanup', () => {
  it('recognizes user links, female namespace, and user templates but ignores excluded markup', () => {
    const content = '[[משתמש:1Or|אור]], [[משתמשת:דנה]] {{א|Foo_Bar|display}}\n'
      + '<!-- [[משתמש:Comment]] -->\n<noinclude>[[משתמש:Documentation]]</noinclude>';
    expect(parseMembers(content).map((entry) => entry.username)).toStrictEqual(['1Or', 'דנה', 'Foo Bar']);
    expect(removeMember(content, 'Foo Bar')).not.toContain('{{א|Foo_Bar|display}}');
    expect(removeMember(content, 'Unknown')).toBeNull();
  });

  it('deletes only the exact username, leaving other users and noinclude untouched', () => {
    const content = '[[משתמש:1Or]], [[משתמש:1OrExtra]], {{א|Dana}}'
      + '<noinclude>[[משתמש:1Or]]</noinclude>';
    expect(removeMember(content, '1Or')).toBe(
      '[[משתמש:1OrExtra]], {{א|Dana}}<noinclude>[[משתמש:1Or]]</noinclude>',
    );
    expect(removeMember('{{א|1Or}} / [[משתמש:1Or]]', '1Or')).toBeNull();
  });

  it('collects experts from template subpages independently of any Mod report', async () => {
    const api = mockWiki();
    const experts = await listKnowledgeExperts(api);
    expect(experts).toStrictEqual([
      { username: '1Or', title: css },
      { username: 'דנה', title: css },
      { username: 'פעיל', title: css },
      { username: '1Or', title: html },
    ]);
    expect(api.allPages).toHaveBeenCalledWith(10, 'בעלי ידע/');
  });

  it('rejects templates without fetched source rather than silently skipping them', async () => {
    const api = mockWiki();
    api.allPages.mockImplementation(async function* pages() {
      yield [{ title: css }] as any;
    });
    await expect(listKnowledgeExperts(api)).rejects.toThrow('Missing template content');
  });

  it('parses pending and closed warnings and formats multiple groups of ten topics', () => {
    const warning = warningMessage(['CSS', 'HTML'], now);
    const parsed = pendingWarning(warning);
    expect(parsed?.topics).toStrictEqual(['CSS', 'HTML']);
    expect(pendingWarning(closeWarning(warning, parsed!, 'ההסרה בוטלה'))).toBeNull();
    expect(formerExpertTemplates(Array.from({ length: 11 }, (_, i) => String(i))))
      .toBe('{{בעל ידע לשעבר|0|1|2|3|4|5|6|7|8|9}}\n{{בעל ידע לשעבר|10}}');
  });

  it('plans a single warning per inactive user, including all topics, with no edits by default', async () => {
    const api = mockWiki();
    const report = await runInactiveKnowledgeExperts(api, { now, maxUsers: 1 });
    expect(report).toMatchObject({ totalUsers: 3, dryRun: true, warned: ['1Or'] });
    expect(api.edit).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('writes only a talk-page warning in its first live run', async () => {
    const api = mockWiki();
    await runInactiveKnowledgeExperts(api, { now, maxUsers: 1, dryRun: false });
    expect(api.edit).toHaveBeenCalledTimes(1);
    expect(api.edit).toHaveBeenCalledWith(
      'שיחת משתמש:1Or', 'התראה לפני הסרה מרשימות בעלי הידע',
      expect.stringContaining('[[תבנית:בעלי ידע/HTML]]'), 27,
    );
  });

  it('creates a missing talk page to send the warning', async () => {
    const api = mockWiki();
    api.info.mockResolvedValue([{ title: 'שיחת משתמש:1Or', missing: '' }]);
    await runInactiveKnowledgeExperts(api, { now, maxUsers: 1, dryRun: false });
    expect(api.create).toHaveBeenCalledWith(
      'שיחת משתמש:1Or', expect.any(String), expect.stringContaining('שלום, ותודה'),
    );
  });

  it('does not remove an expert before a full calendar month passes', async () => {
    const api = mockWiki(warningMessage(['CSS'], new Date('2026-11-20T00:00:00Z')));
    const report = await runInactiveKnowledgeExperts(api, { now, maxUsers: 1, dryRun: false });
    expect(report.skipped).toStrictEqual(['1Or']);
    expect(api.edit).not.toHaveBeenCalled();
  });

  it('removes all warned memberships after one month and replies to the original section', async () => {
    const api = mockWiki(warningMessage(['CSS', 'HTML'], new Date('2026-11-09')));
    const report = await runInactiveKnowledgeExperts(api, { now, maxUsers: 1, dryRun: false });
    expect(report.removed).toStrictEqual(['1Or']);
    expect(api.edit).toHaveBeenCalledTimes(3);
    expect(api.edit).toHaveBeenNthCalledWith(
      1, css, expect.any(String), '[[משתמשת:דנה]], [[משתמש:פעיל]]', 25,
    );
    expect(api.edit).toHaveBeenNthCalledWith(2, html, expect.any(String), '', 26);
    expect(api.edit).toHaveBeenNthCalledWith(
      3, 'שיחת משתמש:1Or', expect.any(String), expect.stringContaining('{{בעל ידע לשעבר|CSS|HTML}}'), 27,
    );
  });

  it('cancels removal after new user contributions', async () => {
    const api = mockWiki(warningMessage(['CSS'], new Date('2026-11-09')));
    api.userContributes.mockImplementation(async function* active() {
      yield [{ title: 'Article' }] as any;
    });
    const report = await runInactiveKnowledgeExperts(api, { now, maxUsers: 1, dryRun: false });
    expect(report.canceled).toStrictEqual(['1Or']);
    expect(api.edit).toHaveBeenCalledTimes(1);
    expect(api.edit.mock.calls[0][0]).toBe('שיחת משתמש:1Or');
  });

  it('does not repeat a completed notification on a second run', async () => {
    const closed = closeWarning(
      warningMessage(['CSS'], new Date('2026-11-09')),
      pendingWarning(warningMessage(['CSS'], new Date('2026-11-09')))!,
      'הוסר',
    );
    expect(pendingWarning(closed)).toBeNull();
  });

  it('fails safely on ambiguous multiple entries rather than removing arbitrary source text', async () => {
    const api = mockWiki(
      warningMessage(['CSS'], new Date('2026-11-09')), '[[משתמש:1Or]], {{א|1Or}}',
    );
    await expect(runInactiveKnowledgeExperts(api, { now, maxUsers: 1, dryRun: false }))
      .rejects.toThrow('Ambiguous knowledge expert entry');
    expect(api.edit).not.toHaveBeenCalled();
  });
});
