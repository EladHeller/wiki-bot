import {
  describe, expect, it, jest,
} from '@jest/globals';
import WikiApi from '../wiki/WikiApi';
import BaseWikiApiMock from '../../testConfig/mocks/baseWikiApi.mock';

describe('wiki API page snapshots', () => {
  it('requests the latest revision and page flags by title without following redirects', async () => {
    const base = BaseWikiApiMock();
    const page = { title: 'שיחה:א & ב', redirect: '', revisions: [{ revid: 20 }] };
    base.request.mockResolvedValue({ query: { pages: { 1: page } } });
    const result = await WikiApi(base).getPage(page.title);
    const params = new URLSearchParams(base.request.mock.calls[0][0]);

    expect(result).toStrictEqual(page);
    expect(Object.fromEntries(params)).toStrictEqual({
      action: 'query',
      format: 'json',
      prop: 'revisions|info',
      rvprop: 'ids|content',
      rvslots: 'main',
      rvlimit: '1',
      rvdir: 'older',
      titles: page.title,
    });
  });

  it('requests the most recent revision at or before the given timestamp', async () => {
    const base = BaseWikiApiMock();
    const page = { title: 'Page', revisions: [{ revid: 10 }] };
    base.request.mockResolvedValue({ query: { pages: { 1: page } } });
    const result = await WikiApi(base).getPage('Page', new Date('2026-10-05T10:00:00Z'));
    const params = new URLSearchParams(base.request.mock.calls[0][0]);

    expect(result).toStrictEqual(page);
    expect(params.get('rvstart')).toBe('2026-10-05T10:00:00.000Z');
    expect(params.get('rvdir')).toBe('older');
    expect(params.get('rvlimit')).toBe('1');
  });

  it.each([
    { title: 'Page', missing: '' },
    { title: 'Page' },
    { title: 'Page', revisions: [{ revid: 20, texthidden: '' }] },
  ])('preserves missing pages, absent historical revisions and suppressed content: %j', async (page) => {
    const base = BaseWikiApiMock();
    base.request.mockResolvedValue({ query: { pages: { 1: page } } });

    await expect(WikiApi(base).getPage('Page')).resolves.toStrictEqual(page);
  });

  it('rejects responses without a page', async () => {
    const base = BaseWikiApiMock();
    base.request.mockResolvedValue({ query: { pages: {} } });

    await expect(WikiApi(base).getPage('Page')).rejects.toThrow('No page returned for Page');
  });
});

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
