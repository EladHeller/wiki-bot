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
