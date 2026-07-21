import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { Mocked } from '../../testConfig/mocks/types';
import { IWikiApi } from '../wiki/WikiApi';
import { WikiPage } from '../types';
import BaseWikiApiMock from '../../testConfig/mocks/baseWikiApi.mock';

const mockLanguageApi = WikiApiMock();
const mockBaseWikiApi = BaseWikiApiMock();

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: () => mockLanguageApi,
}));

jest.unstable_mockModule('../wiki/BaseWikiApi', () => ({
  default: () => mockBaseWikiApi,
  defaultConfig: {},
}));

const {
  default: foreignWikipediaMissingLinksParsedContent,
  parseParamValidatorError,
  getParamValidatorErrors,
  readRedirectTarget,
  replaceTemplateForeignTitle,
  formatLog,
  parseRemainingPageTitles,
  formatRemainingPageTitles,
  addTemplateWithoutWikidataItem,
  fixTitleBracketsAndDots,
  handlePageSafely,
  runSinglePage,
} = await import('../interwikiLinks');

describe('foreignWikipediaMissingLinksParsedContent', () => {
  let api: Mocked<IWikiApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockLanguageApi).forEach((value) => {
      if (jest.isMockFunction(value)) {
        value.mockReset();
      }
    });
    api = WikiApiMock();
    api.getParsedContent.mockResolvedValue('<div>No errors</div>');
    api.articleContent.mockResolvedValue({ content: '', revid: 1 });
    api.create.mockResolvedValue({ revid: 1 });
    api.categroyTitles.mockImplementation(async function* generator() {
      yield [{ title: 'Page1' } as WikiPage];
    });
    mockLanguageApi.getRedirecTarget.mockResolvedValue({});
    mockLanguageApi.info.mockResolvedValue([]);
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [];
    });
  });

  it('updates the remaining-pages tracker without writing a log for skipped entries', async () => {
    api.categroyPages.mockImplementation(async function* generator() {
      const x: WikiPage[] = [{
        title: 'Page1', pageid: 1, ns: 0, extlinks: [], revisions: [],
      }];
      yield x;
    });

    await foreignWikipediaMissingLinksParsedContent(api);

    expect(api.articleContent).toHaveBeenCalledWith('ויקיפדיה:בוט/קישורי שפה/דפים שלא תוקנו');
    expect(api.create).not.toHaveBeenCalled();
    expect(api.edit).toHaveBeenCalledWith(
      'ויקיפדיה:בוט/קישורי שפה/דפים שלא תוקנו',
      'תיקון קישורי שפה',
      'הדפים הבאים עדיין נמצאים ב[[:קטגוריה:קישור לערך לא קיים בוויקיפדיה זרה]]:\n\n* [[Page1]]',
      1,
    );
  });

  it('appends successful entries in a human-readable Hebrew section', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T12:34:56.000Z'));
    api.categroyPages.mockImplementation(async function* generator() {
      const x: WikiPage[] = [{
        title: 'Page1',
        pageid: 1,
        ns: 0,
        extlinks: [],
        revisions: [{
          revid: 2,
          slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
          user: 'User',
          size: 1,
        }],
      }];
      yield x;
    });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'Google', to: 'Google Redirect' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    api.info.mockResolvedValueOnce([{ lastrevid: 1 }]);
    await foreignWikipediaMissingLinksParsedContent(api);

    jest.useRealTimers();

    expect(api.edit).toHaveBeenCalledWith(
      'ויקיפדיה:בוט/קישורי שפה',
      'תיקון קישורי שפה',
      '* [[Page1]]: <nowiki>{{אנג|Google}}</nowiki> - [[:en:Google]] ← [[:en:Google Redirect]] - תוקן',
      1,
      '21 ביולי 2026, 15:34',
    );
  });

  it('creates a human-readable Hebrew log section when the log page does not exist', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T12:34:56.000Z'));
    api.categroyPages.mockImplementation(async function* generator() {
      const x: WikiPage[] = [{
        title: 'Page1',
        pageid: 1,
        ns: 0,
        extlinks: [],
        revisions: [{
          revid: 2,
          slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
          user: 'User',
          size: 1,
        }],
      }];
      yield x;
    });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'Google', to: 'Google Redirect' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    api.info.mockResolvedValueOnce([{ missing: '' }]);

    await foreignWikipediaMissingLinksParsedContent(api);

    jest.useRealTimers();

    expect(api.create).toHaveBeenCalledWith(
      'ויקיפדיה:בוט/קישורי שפה',
      'תיקון קישורי שפה',
      '== 21 ביולי 2026, 15:34 ==\n* [[Page1]]: <nowiki>{{אנג|Google}}</nowiki> - [[:en:Google]] ← [[:en:Google Redirect]] - תוקן',
    );
  });

  it('stops before loading page content when the category has no new pages', async () => {
    api.articleContent.mockResolvedValueOnce({
      content: '* [[Page1]]',
      revid: 2,
    });

    await foreignWikipediaMissingLinksParsedContent(api);

    expect(api.categroyTitles).toHaveBeenCalledTimes(1);
    expect(api.categroyPages).not.toHaveBeenCalled();
    expect(api.edit).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('creates the remaining-pages subpage after the first full run', async () => {
    api.articleContent
      .mockRejectedValueOnce(new Error('No revid for ויקיפדיה:בוט/קישורי שפה/דפים שלא תוקנו'))
      .mockResolvedValueOnce({ revid: 1, content: '' });
    api.categroyPages.mockImplementation(async function* generator() {
      yield [];
    });

    await foreignWikipediaMissingLinksParsedContent(api);

    expect(api.create).toHaveBeenCalledWith(
      'ויקיפדיה:בוט/קישורי שפה/דפים שלא תוקנו',
      'תיקון קישורי שפה',
      expect.stringContaining('* [[Page1]]'),
    );
  });

  it('does not load page content when reading the tracking page fails', async () => {
    api.articleContent.mockRejectedValueOnce(new Error('temporary failure'));

    await expect(foreignWikipediaMissingLinksParsedContent(api)).rejects.toThrow('temporary failure');

    expect(api.categroyPages).not.toHaveBeenCalled();
  });
});

describe('remaining category pages', () => {
  it('parses only list entries and normalizes category links', () => {
    expect(parseRemainingPageTitles(`
intro
* [[Page1|display text]]
* [[:קטגוריה:Page2]]
not a list entry [[Ignored]]
`)).toStrictEqual(['Page1', 'קטגוריה:Page2']);
  });

  it('formats a sorted page list without categorizing the tracking page', () => {
    expect(formatRemainingPageTitles(['Page2', 'Page1', 'קטגוריה:Page3'])).toBe(
      'הדפים הבאים עדיין נמצאים ב[[:קטגוריה:קישור לערך לא קיים בוויקיפדיה זרה]]:\n\n'
      + '* [[:קטגוריה:Page3]]\n* [[Page1]]\n* [[Page2]]',
    );
  });

  it('formats an empty page list', () => {
    expect(formatRemainingPageTitles([])).toBe(
      'הדפים הבאים עדיין נמצאים ב[[:קטגוריה:קישור לערך לא קיים בוויקיפדיה זרה]]: אין דפים.',
    );
  });
});

describe('parseParamValidatorError', () => {
  it('parses valid error messages', () => {
    const text = 'שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו';

    expect(parseParamValidatorError(text)).toStrictEqual({
      templateName: 'אנג',
      foreignTitle: 'Google',
      languageCode: 'en',
    });
  });

  it('returns null for invalid strings', () => {
    expect(parseParamValidatorError('invalid string')).toBeNull();
  });
});

describe('getParamValidatorErrors', () => {
  it('extracts errors from parsed html content', () => {
    const html = `
      <div>
        <span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>
        <span class="paramvalidator-error">invalid</span>
      </div>
    `;

    expect(getParamValidatorErrors(html)).toStrictEqual([
      {
        templateName: 'אנג',
        foreignTitle: 'Google',
        languageCode: 'en',
      },
    ]);
  });

  it('handles element with empty string textContent', () => {
    const html = '<span class="paramvalidator-error"></span>';

    expect(getParamValidatorErrors(html)).toStrictEqual([]);
  });
});

describe('readRedirectTarget', () => {
  it('extracts redirect target', () => {
    expect(readRedirectTarget('#הפניה [[עב-ידיים]]')).toBe('עב-ידיים');
    expect(readRedirectTarget('#REDIRECT [[Handedness]]')).toBe('Handedness');
    expect(readRedirectTarget('#REDIRECT [[Handedness#Section]]')).toBeNull();
    expect(readRedirectTarget('no redirect')).toBeNull();
  });
});

describe('replaceTemplateForeignTitle', () => {
  it('replaces foreign title parameter', () => {
    const content = '{{אנג|Google}}';

    expect(replaceTemplateForeignTitle(content, 'Title', 'אנג', 'Google', 'NewGoogle', false)).toBe('{{אנג|NewGoogle}}');
  });

  it('replaces foreign title in multi-param template, preserving other params', () => {
    const content = '{{אנג|Google|ExtraParam}}';

    expect(replaceTemplateForeignTitle(content, 'Title', 'אנג', 'Google', 'NewGoogle', false)).toBe('{{אנג|NewGoogle|ExtraParam}}');
  });

  it('adds original title as second parameter when requested', () => {
    const content = '{{אנג|Google}}';

    expect(replaceTemplateForeignTitle(content, 'Title', 'אנג', 'Google', 'NewGoogle', true)).toBe('{{אנג|NewGoogle|Google}}');
  });

  it('returns same content if template has no params (no pipe separator)', () => {
    const content = '{{אנג}}';

    expect(replaceTemplateForeignTitle(content, 'Title', 'אנג', 'Google', 'NewGoogle', false)).toBe(content);
  });

  it('returns same content if template not found', () => {
    const content = '{{אנג|Google}}';

    expect(replaceTemplateForeignTitle(content, 'Title', 'גרמ', 'Google', 'NewGoogle', false)).toBe(content);
  });

  it('returns same content if parameter not found in arrayData', () => {
    const content = '{{אנג|Google}}';

    expect(replaceTemplateForeignTitle(content, 'Title', 'אנג', 'NotInTemplate', 'NewGoogle', false)).toBe(content);
  });
});

describe('addTemplateWithoutWikidataItem', () => {
  it('adds ללא פריט=כן to matching template', () => {
    const content = '{{אנג|Google}}';

    expect(addTemplateWithoutWikidataItem(content, 'Title', 'אנג', 'Google')).toBe('{{אנג|Google|ללא פריט=כן}}');
  });

  it('preserves existing params when adding ללא פריט=כן', () => {
    const content = '{{אנג|Google|שם=גוגל}}';

    expect(addTemplateWithoutWikidataItem(content, 'Title', 'אנג', 'Google')).toBe('{{אנג|Google|שם=גוגל|ללא פריט=כן}}');
  });

  it('returns same content when matching template is not found', () => {
    const content = '{{גרמ|Google}}';

    expect(addTemplateWithoutWikidataItem(content, 'Title', 'אנג', 'Google')).toBe(content);
  });
});

describe('formatLog', () => {
  it('formats successful log entries', () => {
    expect(formatLog({
      pageTitle: 'Page',
      templateName: 'אנג',
      foreignTitle: 'Google',
      languageCode: 'en',
      success: true,
    })).toContain('- תוקן');
  });
});

describe('fixTitleBracketsAndDots', () => {
  it('returns null when no changes are needed', () => {
    expect(fixTitleBracketsAndDots('English Title')).toBeNull();
    expect(fixTitleBracketsAndDots('עברית')).toBeNull();
    expect(fixTitleBracketsAndDots('Title.')).toBeNull();
    expect(fixTitleBracketsAndDots('(עברית)')).toBeNull();
    expect(fixTitleBracketsAndDots('[עברית]')).toBeNull();
  });

  it('strips leading commas and dots only', () => {
    expect(fixTitleBracketsAndDots('.Title')).toBe('Title');
    expect(fixTitleBracketsAndDots(',Title')).toBe('Title');
    expect(fixTitleBracketsAndDots('...Title')).toBe('Title');
    expect(fixTitleBracketsAndDots(',,,Title')).toBe('Title');
  });

  it('removes unmatched ending brackets', () => {
    expect(fixTitleBracketsAndDots('Title)')).toBe('Title');
    expect(fixTitleBracketsAndDots('Title]')).toBe('Title');
    expect(fixTitleBracketsAndDots('Title))')).toBe('Title');
    expect(fixTitleBracketsAndDots('Title]]')).toBe('Title');
  });

  it('does not strip unsupported punctuation', () => {
    expect(fixTitleBracketsAndDots('Title,')).toBeNull();
    expect(fixTitleBracketsAndDots('.Title.')).toBe('Title.');
    expect(fixTitleBracketsAndDots('(Title')).toBeNull();
  });
});

describe('handlePageSafely and page processing logic', () => {
  let api: Mocked<IWikiApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockLanguageApi).forEach((value) => {
      if (jest.isMockFunction(value)) {
        value.mockReset();
      }
    });

    api = WikiApiMock();
    api.login.mockResolvedValue(undefined);
    api.getParsedContent.mockResolvedValue('<div>No errors</div>');
    api.articleContent.mockResolvedValue({ content: '', revid: 1 });
    api.create.mockResolvedValue({});
    mockLanguageApi.getRedirecTarget.mockResolvedValue({});
    mockLanguageApi.info.mockResolvedValue([]);
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [];
    });
    api.categroyPages.mockImplementation(async function* generator() {
      const x: WikiPage[] = [];
      yield x;
    });
  });

  it('handles invalid title', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "{Google}" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.info.mockResolvedValueOnce([{ invalid: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|{Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('invalid title'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles invalid title that becomes valid after normalization', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "{Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.info
      .mockResolvedValueOnce([{ invalid: '' }])
      .mockResolvedValueOnce([{ title: 'Google' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|{Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|Google}}', 123);
  });

  it('handles invalid title that stays invalid after normalization', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "{Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.info
      .mockResolvedValueOnce([{ invalid: '' }])
      .mockResolvedValueOnce([{ invalid: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|{Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('invalid title'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles page with no validator errors found', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<div>No errors</div>');
    const page = {
      title: 'TestPage', pageid: 1, ns: 0, extlinks: [], revisions: [],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('no errors found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles page with no revisions content', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    const page = {
      title: 'TestPage', pageid: 1, ns: 0, extlinks: [], revisions: [],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot read properties of undefined (reading 'slots')"));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles page with revisions but missing content or revid', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 0, // invalid revid
        slots: { main: { '*': '', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 0,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith('No content or revid for', 'TestPage');

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles interwiki check error', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('probably interwiki'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles missing redirect but not interwiki and missing info check (empty array value)', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('target not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles missing redirect when search returns no value (undefined)', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    // @ts-ignore
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield null;
    });
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('target not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles redirect not found or invalid but has a search match', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    mockLanguageApi.search.mockImplementation(async function* generator() {
      const page: WikiPage = {
        title: 'google', pageid: 2, ns: 0, extlinks: [], revisions: [],
      };
      yield [page];
    });
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|google}}', 123);
  });

  it('handles checkMissingRedirect original title exists (info.missing is null)', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    mockLanguageApi.getWikiDataItem.mockResolvedValueOnce('Q1');
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('redirect not found or invalid'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles redirect not found but has a different title normalized match', async () => {
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]); // for original title
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [{
        title: 'Google', pageid: 2, ns: 0, extlinks: [], revisions: [],
      }];
    });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור ".Google." בשפה en אך ערך זה לא קיים בשפה זו</span>');
    api.categroyPages.mockImplementation(async function* generator() {
      yield [];
    });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: undefined }]); // for normalized title
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|.Google.}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledTimes(1);
    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|Google.}}', 123);
  });

  it('handles successful redirect translation and does edit', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'NewGoogle' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|NewGoogle}}', 123);
  });

  it('handles redirect target with hex numeric entity in revision content', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'Hex Target' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|Hex Target}}', 123);
  });

  it('handles redirect target with decimal numeric entity in revision content', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'Decimal Target' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|Decimal Target}}', 123);
  });

  it('replaces target with brackets and preserves original source as second parameter', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'TestPage (test)' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|TestPage (test)|Google}}', 123);
  });

  it('falls back to normal handling when target has brackets but source template is not matched', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'TestPage (test)' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{גרמ|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('matching template not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handle interwiki likns', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValue([]);

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|en:TestPage}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('probably interwiki'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handle missing', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValue([{
      missing: '',
    }]);
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [];
    });

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('target not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handle page exists', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValue([{
      missing: '',
    }]);
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    mockLanguageApi.getWikiDataItem.mockResolvedValueOnce('Q1');

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('redirect not found or invalid'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('adds ללא פריט=כן when page exists and has no wikidata item', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    mockLanguageApi.getWikiDataItem.mockResolvedValueOnce(undefined);

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|Google|ללא פריט=כן}}', 123);
    expect(mockLanguageApi.getWikiDataItem).toHaveBeenCalledWith('Google');
  });

  it('skips without wikidata item when matching template is not found', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    mockLanguageApi.getWikiDataItem.mockResolvedValueOnce(undefined);

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{גרמ|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('matching template not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handle search - no results', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValue([{
      missing: '',
    }]);
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google', missing: '' }]);

    // @ts-ignore
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield null;
    });

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('target not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handle search - with many results', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValue([{
      missing: '',
    }]);
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google', missing: '' }]);

    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [
        {
          title: 'Google',
          pageid: 1,
          ns: 0,
          extlinks: [],
        },
        {
          title: 'Google2',
          pageid: 2,
          ns: 0,
          extlinks: [],
        },
      ];
    });

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('target not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handle search - with one result', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({
      redirect: {
        from: '',
        to: '',
      },
    });
    mockLanguageApi.info.mockResolvedValue([{
      missing: '',
    }]);
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google', missing: '' }]);

    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [
        {
          title: 'google',
          pageid: 1,
          ns: 0,
          extlinks: [],
        },
      ];
    });

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|google}}', 123);
  });

  it('handles normalized title that exists after search does not match exactly', async () => {
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור ".Google." בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [
        {
          title: 'Google2',
          pageid: 1,
          ns: 0,
          extlinks: [],
        },
      ];
    });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|.Google.}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|Google.}}', 123);
  });

  it('keeps page unchanged when normalized title is also missing', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור ".Google." בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({});
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [
        {
          title: 'Google2',
          pageid: 1,
          ns: 0,
          extlinks: [],
        },
      ];
    });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google', missing: '' }]);

    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|.Google.}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };

    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('target not found'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles redirect with section', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'NewGoogle', tosection: 'section' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('redirect has section target'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles redirect with fragment', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'NewGoogle', tofragment: 'fragment' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ title: 'Google' }]);
    const page = {
      title: 'TestPage',
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [{
        revid: 123,
        slots: { main: { '*': '{{אנג|Google}}', contentmodel: 'wikitext', contentformat: 'text/x-wiki' } },
        user: 'User',
        size: 100,
      }],
    };
    await handlePageSafely(api, page);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('redirect has section target'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles error safely in handlePageSafely', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    api.getParsedContent.mockRejectedValueOnce(new Error('api error'));
    const page = {
      title: 'TestPage', pageid: 1, ns: 0, extlinks: [], revisions: [],
    };

    await expect(handlePageSafely(api, page)).resolves.not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('api error'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles error with data property but no message', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    const errWithData = { data: 'some error data', toString: () => 'error string' };
    api.getParsedContent.mockRejectedValueOnce(errWithData);
    const page = {
      title: 'TestPage', pageid: 1, ns: 0, extlinks: [], revisions: [],
    };

    await expect(handlePageSafely(api, page)).resolves.not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('some error data'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('handles error with no message or data, falls back to toString()', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    const errNoMessage = { toString: () => 'fallback error string' };
    api.getParsedContent.mockRejectedValueOnce(errNoMessage);
    const page = {
      title: 'TestPage', pageid: 1, ns: 0, extlinks: [], revisions: [],
    };

    await expect(handlePageSafely(api, page)).resolves.not.toThrow();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('fallback error string'));

    consoleLogSpy.mockRestore();

    expect(api.edit).not.toHaveBeenCalled();
  });
});

describe('runSinglePage', () => {
  let api: Mocked<IWikiApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockLanguageApi).forEach((value) => {
      if (jest.isMockFunction(value)) {
        value.mockReset();
      }
    });
    api = WikiApiMock();
    api.login.mockResolvedValue(undefined);
    api.getParsedContent.mockResolvedValue('<div>No errors</div>');
    api.articleContent.mockResolvedValue({ content: '', revid: 1 });
    api.create.mockResolvedValue({ revid: 1 });
    mockLanguageApi.getRedirecTarget.mockResolvedValue({});
    mockLanguageApi.info.mockResolvedValue([]);
    mockLanguageApi.search.mockImplementation(async function* generator() {
      yield [];
    });
  });

  it('runs successfully for single page', async () => {
    api.articleContent.mockResolvedValueOnce({ content: '{{אנג|Google}}', revid: 123 });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'NewGoogle' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);
    await runSinglePage('TestPage', api);

    expect(api.edit).toHaveBeenCalledWith('TestPage', 'תיקון קישורי שפה', '{{אנג|NewGoogle}}', 123);
  });

  it('does not edit a page when the matching template is not found', async () => {
    api.articleContent.mockResolvedValueOnce({ content: '{{גרמ|Google}}', revid: 123 });
    api.getParsedContent.mockResolvedValueOnce('<span class="paramvalidator-error">שימוש בתבנית אנג עבור "Google" בשפה en אך ערך זה לא קיים בשפה זו</span>');
    mockLanguageApi.getRedirecTarget.mockResolvedValueOnce({ redirect: { from: 'TestPage', to: 'NewGoogle' } });
    mockLanguageApi.info.mockResolvedValueOnce([{ missing: '' }]);

    await runSinglePage('TestPage', api);

    expect(api.edit).not.toHaveBeenCalled();
  });
});
