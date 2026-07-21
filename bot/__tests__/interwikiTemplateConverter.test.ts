import {
  afterEach, describe, expect, it, jest,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import interwikiTemplateConverter, {
  LANGUAGE_TEMPLATES,
  checkPage,
  convertInterwikiLinksToTemplates,
} from '../scripts/oneTime/interwikiTemplateConverter';

const languageLink = (languageCode = 'en', foreignTitle = 'Link_to_english', linkLabel = 'אנ') => (
  `<small>([[:${languageCode}:${foreignTitle}|${linkLabel}']])</small>`
);

const supportedLanguageTemplates = [
  ['uk', 'אוק', ['אוק']],
  ['it', 'איט', ['איט']],
  ['sq', 'אלב', ['אלב']],
  ['en', 'אנ', ['אנ']],
  ['et', 'אסט', ['אסט']],
  ['bg', 'בול', ['בול']],
  ['be', 'בלא', ['בלא']],
  ['ka', 'גאו', ['גאו']],
  ['de', 'גר', ['גר']],
  ['da', 'דנ', ['דנ']],
  ['hu', 'הו', ['הו']],
  ['nl', 'הול', ['הול']],
  ['tr', 'טר', ['טר']],
  ['el', 'יוו', ['יוו']],
  ['yi', 'יי', ['יי']],
  ['ja', 'יפ', ['יפ']],
  ['lv', 'לטב', ['לטב']],
  ['lt', 'ליט', ['ליט']],
  ['mk', 'מק', ['מק']],
  ['no', 'נו', ['נו']],
  ['zh', 'סי', ['סי']],
  ['es', 'ספ', ['ספ']],
  ['ar', 'ער', ['ער']],
  ['pt', 'פור', ['פור']],
  ['fi', 'פי', ['פי']],
  ['pl', 'פל', ['פול', 'פל']],
  ['fa', "פר'", ['פר']],
  ['cs', "צ'כ", ['צכ', "צ'כ", 'צ׳כ']],
  ['fr', 'צר', ['צר']],
  ['ko', 'קו', ['קו']],
  ['ru', 'רו', ['רו']],
  ['ro', 'רומ', ['רומ']],
  ['sv', 'שוו', ['שוו']],
] as const;

describe('interwikiTemplateConverter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps every supported language to its preferred short template', () => {
    const content = supportedLanguageTemplates
      .map(([languageCode, , [linkLabel]]) => languageLink(languageCode, `Page_${languageCode}`, linkLabel))
      .join(' ');
    const expectedContent = supportedLanguageTemplates
      .map(([languageCode, templateName]) => `{{${templateName}|Page ${languageCode}}}`)
      .join(' ');
    const expectedTemplates = Object.fromEntries(
      supportedLanguageTemplates.map(([languageCode, templateName, linkLabels]) => [
        languageCode,
        { templateName, linkLabels: [...linkLabels] },
      ]),
    );

    expect(LANGUAGE_TEMPLATES).toStrictEqual(expectedTemplates);
    expect(convertInterwikiLinksToTemplates(content)).toBe(expectedContent);
  });

  it('handles case, geresh variants, years, and punctuation inside the small tag', () => {
    const content = 'לפני <SMALL> ( [[:EN:English_text|אנ׳]]) (2020-2021, 2023),{{ש}}.</SMALL> אחרי';

    expect(convertInterwikiLinksToTemplates(content)).toBe(
      'לפני {{אנ|English text}} <small>(2020-2021, 2023)</small>,{{ש}}. אחרי',
    );
  });

  it('handles a period before the closing small tag', () => {
    expect(convertInterwikiLinksToTemplates("<small>([[:en:English text|אנ']]).</small>"))
      .toBe('{{אנ|English text}}.');
  });

  it('converts language-code link labels', () => {
    const content = `${languageLink('en', 'Link_to_english', 'en')} ${languageLink('EN', 'Another_link', 'EN')}`;

    expect(convertInterwikiLinksToTemplates(content))
      .toBe('{{אנ|Link to english}} {{אנ|Another link}}');
  });

  it('accepts template-name variants of Polish and Czech link labels', () => {
    const content = [
      languageLink('pl', 'Polish_page', 'פל'),
      languageLink('cs', 'Czech_page', "צ'כ"),
      languageLink('cs', 'Another_Czech_page', 'צ׳כ'),
    ].join(' ');

    expect(convertInterwikiLinksToTemplates(content))
      .toBe("{{פל|Polish page}} {{צ'כ|Czech page}} {{צ'כ|Another Czech page}}");
  });

  it('does not convert unknown languages, mismatched labels, or non-Wikipedia projects', () => {
    const links = [
      languageLink('xx', 'Unknown', 'אנ'),
      languageLink('en', 'English', 'צר'),
      languageLink('en', 's:English', 'אנ'),
    ];
    const content = links.join(' ');

    expect(convertInterwikiLinksToTemplates(content)).toBe(content);
  });

  it('edits a requested page', async () => {
    const api = WikiApiMock();
    api.articleContent.mockResolvedValue({ content: languageLink(), revid: 123 });

    await checkPage(api, 'ערך');

    expect(api.edit).toHaveBeenCalledWith(
      'ערך',
      'הסבת קישורים לוויקיפדיות זרות לתבניות שפה',
      '{{אנ|Link to english}}',
      123,
    );
  });

  it('skips requested pages without matches or usable content and revisions', async () => {
    const api = WikiApiMock();
    api.articleContent
      .mockResolvedValueOnce({ content: 'ללא קישור', revid: 123 })
      .mockResolvedValueOnce({ content: '', revid: 123 })
      .mockResolvedValueOnce({ content: languageLink(), revid: 0 });

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
              '*': languageLink('de', 'German_page', 'גר'),
            },
          },
        }],
      }];
    });

    await interwikiTemplateConverter(api);

    expect(api.search).toHaveBeenCalledWith(
      expect.stringContaining('([a-zA-Z-]+):'),
      false,
      '0|14|100',
    );
    expect(api.edit).toHaveBeenCalledWith(
      'ערך',
      'הסבת קישורים לוויקיפדיות זרות לתבניות שפה',
      '{{גר|German page}}',
      123,
    );
  });
});
