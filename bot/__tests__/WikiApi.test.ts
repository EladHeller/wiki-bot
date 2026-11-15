import {
  describe, expect, it, jest,
} from '@jest/globals';
import WikiApi from '../wiki/WikiApi';
import BaseWikiApiMock from '../../testConfig/mocks/baseWikiApi.mock';

describe('wiki API search pagination', () => {
  it('requests a stable title order and preserves all search batches', async () => {
    const baseWikiApi = BaseWikiApiMock();
    const responses = [
      { query: { pages: { 1: { pageid: 1, title: 'שיחת קטגוריה:א' } } } },
      { query: { pages: { 2: { pageid: 2, title: 'שיחת קטגוריה:ב' } } } },
    ];
    baseWikiApi.continueQuery.mockImplementation(async function* query(_path, selector) {
      yield* responses.map((response) => selector?.(response));
    });
    const batches = [];
    for await (const batch of WikiApi(baseWikiApi).searchPages('creationdate:2025', [15], 25)) {
      batches.push(batch);
    }
    const params = new URLSearchParams(baseWikiApi.continueQuery.mock.calls[0][0]);

    expect(params.get('gsrsort')).toBe('title_natural_asc');
    expect(params.get('gsrlimit')).toBe('25');
    expect(params.get('gsrsearch')).toBe('creationdate:2025');
    expect(params.get('gsrnamespace')).toBe('15');
    expect(batches).toStrictEqual(responses.map((response) => Object.values(response.query.pages)));
  });
});

describe('wiki API edit assertions', () => {
  it('asserts bot rights and marks edits as bot edits by default', async () => {
    const baseWikiApi = BaseWikiApiMock({
      login: jest.fn<() => Promise<string>>().mockResolvedValue('token'),
      request: jest.fn<() => Promise<any>>().mockResolvedValue({ edit: { result: 'Success' } }),
    });

    const wikiApi = WikiApi(baseWikiApi);
    await wikiApi.edit('Page', 'Summary', 'Content', 1);
    await wikiApi.create('New page', 'Summary', 'Content');

    expect(baseWikiApi.request).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('&assert=bot&bot=true'),
      'post',
      expect.any(URLSearchParams),
    );
    expect(baseWikiApi.request).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('&assert=bot&bot=true'),
      'post',
      expect.any(URLSearchParams),
    );
  });

  it('asserts user rights without marking the edit when bot rights are disabled', async () => {
    const baseWikiApi = BaseWikiApiMock({
      assertBot: false,
      login: jest.fn<() => Promise<string>>().mockResolvedValue('token'),
      request: jest.fn<() => Promise<any>>().mockResolvedValue({ edit: { result: 'Success' } }),
    });

    const wikiApi = WikiApi(baseWikiApi);
    await wikiApi.edit('Page', 'Summary', 'Content', 1);
    await wikiApi.create('New page', 'Summary', 'Content');

    const paths = baseWikiApi.request.mock.calls.map(([path]) => path);

    expect(paths).toStrictEqual([
      expect.stringContaining('&assert=user'),
      expect.stringContaining('&assert=user'),
    ]);
    expect(paths).toStrictEqual([
      expect.not.stringContaining('bot=true'),
      expect.not.stringContaining('bot=true'),
    ]);
  });
});

describe('wiki API knowledge-expert lookups', () => {
  it('filters all-pages at the source and keeps each batch within the revision limit', async () => {
    const base = BaseWikiApiMock();
    base.continueQuery.mockImplementation(async function* query(_path, selector) {
      yield selector?.({ query: { pages: { 1: { title: 'Template:A/B' } } } });
    });
    const api = WikiApi(base);
    const result = await api.allPages(10, '', 'A/').next();
    const params = new URLSearchParams(base.continueQuery.mock.calls[0][0]);

    expect(Object.fromEntries(params)).toMatchObject({
      generator: 'allpages', gapnamespace: '10', gaplimit: '50', gapprefix: 'A/', gapfilterredir: 'nonredirects',
    });
    expect(result.value).toStrictEqual([{ title: 'Template:A/B' }]);
  });

  it('loads page source and author together without following redirects', async () => {
    const page = { title: 'User talk:Alice', redirect: '', revisions: [{ revid: 12, user: 'Alice' }] };
    const base = BaseWikiApiMock();
    base.request.mockResolvedValue({ query: { pages: { 1: page } } });

    await expect(WikiApi(base).getPage(page.title)).resolves.toBe(page);

    const params = new URLSearchParams(base.request.mock.calls[0][0]);

    expect(Object.fromEntries(params)).toMatchObject({
      prop: 'info|revisions', rvprop: 'content|ids|user', rvslots: 'main', titles: page.title,
    });
    expect(params.has('redirects')).toBe(false);
  });

  it('batches user lookups and drops unregistered accounts', async () => {
    const base = BaseWikiApiMock();
    base.request
      .mockResolvedValueOnce({
        query: {
          users: [
            { name: 'User 0', userid: 4, registration: null }, { name: 'Unregistered', missing: '' },
          ],
        },
      })
      .mockResolvedValueOnce({ query: { users: [{ name: 'Space & Co', userid: 7, registration: '2020-01-01T01:00:00Z' }] } });
    const names = [...Array.from({ length: 50 }, (_, i) => `User ${i}`), 'Space & Co'];
    const result = await WikiApi(base).registeredUsers(names);

    expect(result).toStrictEqual([
      { name: 'User 0', registration: null }, { name: 'Space & Co', registration: '2020-01-01T01:00:00Z' },
    ]);
    expect(base.request.mock.calls.map(([path]) => new URLSearchParams(path).get('ususers')?.split('|')))
      .toStrictEqual([names.slice(0, 50), ['Space & Co']]);
  });

  it('bounds recovery history by bot author and earliest date', async () => {
    const base = BaseWikiApiMock();
    base.continueQuery.mockImplementation(async function* query(_path, selector) {
      yield selector?.({ query: { pages: { 1: { revisions: [{ revid: 2 }] } } } });
    });
    const since = new Date('2026-08-01T00:00Z');
    const api = WikiApi(base);
    const result = await api.getArticleRevisions('Page', 25, 'ids', { user: 'A & B', since }).next();

    expect(Object.fromEntries(new URLSearchParams(base.continueQuery.mock.calls[0][0]))).toMatchObject({
      rvuser: 'A & B', rvend: since.toISOString(), rvlimit: '25',
    });
    expect(result.value).toStrictEqual([{ revid: 2 }]);
  });
});
