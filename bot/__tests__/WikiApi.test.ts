import {
  describe, expect, it, jest,
} from '@jest/globals';
import WikiApi from '../wiki/WikiApi';
import BaseWikiApiMock from '../../testConfig/mocks/baseWikiApi.mock';

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
