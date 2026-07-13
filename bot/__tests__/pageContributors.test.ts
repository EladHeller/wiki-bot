import {
  describe, expect, it,
} from '@jest/globals';
import pageContributors from '../scripts/oneTime/pageContributors';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('pageContributors', () => {
  it('should throw an error if page is missing/empty revisions', async () => {
    const api = WikiApiMock();
    api.getArticleRevisions.mockImplementation(async function* generator() {
      yield [];
    });

    await expect(pageContributors(api, 'MissingPage')).rejects.toThrow('Page "MissingPage" not found.');
  });

  it('should aggregate contributions and handle revision without user property', async () => {
    const api = WikiApiMock();
    api.getArticleRevisions.mockImplementation(async function* generator() {
      yield [
        { user: 'UserA', size: 100, slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': '' } } },
        { user: 'UserB', size: 100, slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': '' } } },
        { size: 100, slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': '' } } } as any,
        { user: 'UserA', size: 100, slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': '' } } },
      ];
    });

    const result = await pageContributors(api, 'Test');

    expect(api.getArticleRevisions).toHaveBeenCalledWith('Test', 500, 'user');

    expect(result).toStrictEqual({
      UserA: 2,
      UserB: 1,
      'Unknown/Hidden': 1,
    });
  });

  it('should return all revisions and cut it after limit', async () => {
    const api = WikiApiMock();
    api.getArticleRevisions.mockImplementation(async function* generator() {
      yield Array.from({ length: 1005 }, () => ({
        user: 'UserA',
        size: 100,
        slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': '' } },
      }));
    });

    const result = await pageContributors(api, 'Test');

    expect(result).toStrictEqual({
      UserA: 1005,
    });
  });
});
