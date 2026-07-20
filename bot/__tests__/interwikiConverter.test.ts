import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { IWikiApi } from '../wiki/WikiApi';

const runSinglePage = jest.fn<(title: string, api: IWikiApi) => Promise<void>>();

jest.unstable_mockModule('../interwikiLinks', () => ({ runSinglePage }));

const { checkPage, default: interwikiConverter } = await import('../scripts/oneTime/interwikiConverter');

const languageLink = (languageCode: string, foreignTitle = 'English_text') => `[[עברית]] <small>([[:${languageCode}:${foreignTitle}|טקסט באנגלית]])</small>`;

describe('interwikiConverter', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('does not convert links to non-Wikipedia Wikimedia projects', async () => {
    const api = WikiApiMock();
    api.articleContent.mockResolvedValue({
      content: languageLink('en', 's:English_text'),
      revid: 123,
    });

    await checkPage(api, 'ערך');

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('converts Wikipedia links with optional formatting', async () => {
    const api = WikiApiMock();
    api.articleContent.mockResolvedValue({
      content: '"[[עברית]]" <small>([[:en:English_text|טקסט באנגלית]]) (2020),</small>',
      revid: 123,
    });

    await checkPage(api, 'ערך');

    expect(api.edit).toHaveBeenCalledWith(
      'ערך',
      'הסבת קישורי בינוויקי לתבנית קישור שפה',
      '{{קישור שפה|אנגלית|English text|עברית|מירכאות=כן}} <small>(2020)</small>,',
      123,
    );
  });

  it('skips links with unknown languages and pages without usable revisions', async () => {
    const api = WikiApiMock();
    api.articleContent
      .mockResolvedValueOnce({ content: languageLink('xx'), revid: 123 })
      .mockResolvedValueOnce({ content: '', revid: 123 })
      .mockResolvedValueOnce({ content: languageLink('en'), revid: 0 });

    await checkPage(api, 'ערך');
    await checkPage(api, 'ערך');
    await checkPage(api, 'ערך');

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('runs interwiki checks for converted search results', async () => {
    const api = WikiApiMock();
    api.search.mockImplementation(async function* generator() {
      yield [{
        pageid: 1,
        ns: 0,
        title: 'ערך',
        extlinks: [],
        revisions: [{
          user: 'user',
          size: 1,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': languageLink('en'),
            },
          },
        }],
      }, {
        pageid: 2,
        ns: 0,
        title: 'ערך ללא תוכן',
        extlinks: [],
        revisions: [{
          user: 'user',
          size: 1,
          revid: 124,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': 'ללא קישורים',
            },
          },
        }],
      }];
    });

    await interwikiConverter(api);

    expect(api.search).toHaveBeenCalledWith(
      expect.stringContaining('([a-zA-Z-]+):/'),
      false,
      '0|14|100',
    );
    expect(runSinglePage).toHaveBeenCalledWith('ערך', api);
  });
});
