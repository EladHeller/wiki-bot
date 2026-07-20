import {
  afterEach, describe, expect, it, jest,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import englishInterwikiConverter, {
  checkPage,
  convertEnglishInterwikiLinks,
} from '../scripts/oneTime/englishInterwikiConverter';

const englishLink = (foreignTitle = 'Link_to_english') => `<small>([[:en:${foreignTitle}|אנ']])</small>`;

describe('englishInterwikiConverter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('converts English interwiki links to the English template', () => {
    const content = `לפני ${englishLink()} ואחרי <SMALL> ( [[:EN:Another link|אנ׳]] ) </SMALL>`;

    expect(convertEnglishInterwikiLinks(content)).toBe('לפני {{אנ|Link to english}} ואחרי {{אנ|Another link}}');
  });

  it('does not convert other languages or link labels', () => {
    const content = "<small>([[:fr:Lien|אנ']])</small> <small>([[:en:English link|English]])</small>";

    expect(convertEnglishInterwikiLinks(content)).toBe(content);
  });

  it('edits a requested page', async () => {
    const api = WikiApiMock();
    api.articleContent.mockResolvedValue({ content: englishLink(), revid: 123 });

    await checkPage(api, 'ערך');

    expect(api.edit).toHaveBeenCalledWith(
      'ערך',
      'הסבת קישורים לוויקיפדיה האנגלית לתבנית {{אנ}}',
      '{{אנ|Link to english}}',
      123,
    );
  });

  it('skips requested pages without matches or usable content and revisions', async () => {
    const api = WikiApiMock();
    api.articleContent
      .mockResolvedValueOnce({ content: 'ללא קישור', revid: 123 })
      .mockResolvedValueOnce({ content: '', revid: 123 })
      .mockResolvedValueOnce({ content: englishLink(), revid: 0 });

    await checkPage(api, 'ללא קישור');
    await checkPage(api, 'ללא תוכן');
    await checkPage(api, 'ללא גרסה');

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('converts matching search results', async () => {
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
              '*': englishLink(),
            },
          },
        }],
      }];
    });

    await englishInterwikiConverter(api);

    expect(api.search).toHaveBeenCalledWith(
      expect.stringContaining('\\[\\[:en:'),
      false,
      '0|14|100',
    );
    expect(api.edit).toHaveBeenCalledWith(
      'ערך',
      'הסבת קישורים לוויקיפדיה האנגלית לתבנית {{אנ}}',
      '{{אנ|Link to english}}',
      123,
    );
  });
});
