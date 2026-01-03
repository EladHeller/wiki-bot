import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import {
  fixYearRange,
  processArticle,
  processTemplate,
  TemplateName,
} from '../sportPersonalityTemplatesYearsFormat/model';
import { IWikiApi } from '../wiki/WikiApi';
import { WikiPage } from '../types';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('fixYearRange', () => {
  it('should remove year links', () => {
    expect(fixYearRange('[[1990]]')).toBe('1990');
    expect(fixYearRange('[[1990]]–[[1991]]')).toBe('1990–1991');
    expect(fixYearRange('[[1990]] - [[1991]]')).toBe('1990–1991');
  });

  it('should replace hyphens with en-dash', () => {
    expect(fixYearRange('1990-1991')).toBe('1990–1991');
    expect(fixYearRange('1990 - 1991')).toBe('1990–1991');
    expect(fixYearRange('1990- 1991')).toBe('1990–1991');
    expect(fixYearRange('1990 -1991')).toBe('1990–1991');
  });

  it('should remove spaces around en-dash', () => {
    expect(fixYearRange('1990 – 1991')).toBe('1990–1991');
    expect(fixYearRange('1990– 1991')).toBe('1990–1991');
    expect(fixYearRange('1990 –1991')).toBe('1990–1991');
  });

  it('should handle combined cases', () => {
    expect(fixYearRange('[[1990]] – [[1991]]')).toBe('1990–1991');
    expect(fixYearRange('[[1990]] - [[1991]]')).toBe('1990–1991');
    expect(fixYearRange('[[1990]]-[[1991]]')).toBe('1990–1991');
  });

  it('should handle multiple year ranges', () => {
    expect(fixYearRange('1990-1995, 2000-2005')).toBe('1990–1995, 2000–2005');
    expect(fixYearRange('[[1990]] - [[1995]], [[2000]] - [[2005]]')).toBe('1990–1995, 2000–2005');
  });

  it('should handle empty or null values', () => {
    expect(fixYearRange('')).toBe('');
    expect(fixYearRange('   ')).toBe('   ');
  });

  it('should not modify text without years', () => {
    expect(fixYearRange('some text')).toBe('some text');
    expect(fixYearRange('1990')).toBe('1990');
  });

  it('should handle single year with link', () => {
    expect(fixYearRange('[[1990]]')).toBe('1990');
  });

  it('should handle year ranges with additional text', () => {
    expect(fixYearRange('[[1990]] - [[1991]] (עונה ראשונה)')).toBe('1990–1991 (עונה ראשונה)');
  });

  it('should fix reversed year order - larger year first', () => {
    expect(fixYearRange('1991–1990')).toBe('1990–1991');
    expect(fixYearRange('2000–1995')).toBe('1995–2000');
    expect(fixYearRange('2020–2010')).toBe('2010–2020');
  });

  it('should fix reversed year order with links', () => {
    expect(fixYearRange('[[1991]]–[[1990]]')).toBe('1990–1991');
    expect(fixYearRange('[[2000]] - [[1995]]')).toBe('1995–2000');
  });

  it('should fix reversed year order with spaces', () => {
    expect(fixYearRange('1991 – 1990')).toBe('1990–1991');
    expect(fixYearRange('2000 - 1995')).toBe('1995–2000');
  });

  it('should handle multiple ranges with some reversed', () => {
    expect(fixYearRange('1991–1990, 2000–2005')).toBe('1990–1991, 2000–2005');
    expect(fixYearRange('2005–2000, 2010–2015')).toBe('2000–2005, 2010–2015');
  });

  it('should not change correct order', () => {
    expect(fixYearRange('1990–1991')).toBe('1990–1991');
    expect(fixYearRange('1995–2000')).toBe('1995–2000');
  });

  it('should fix reversed order in complex text', () => {
    expect(fixYearRange('[[1991]]–[[1990]] (עונה ראשונה)')).toBe('1990–1991 (עונה ראשונה)');
    expect(fixYearRange('שנים: 2000–1995, 2010–2015')).toBe('שנים: 1995–2000, 2010–2015');
  });

  it('should remove dash when year is only on one side', () => {
    expect(fixYearRange('2025-')).toBe('2025–');
    expect(fixYearRange('2025–')).toBe('2025–');
    expect(fixYearRange('2025 -')).toBe('2025–');
    expect(fixYearRange('2025 –')).toBe('2025–');
  });

  it('should remove dash when year is only on one side followed by non-digit', () => {
    expect(fixYearRange('2025- (עונה ראשונה)')).toBe('2025– (עונה ראשונה)');
    expect(fixYearRange('2025–,')).toBe('2025–,');
  });

  it('should add space before parentheses after number', () => {
    expect(fixYearRange('6(2)')).toBe('6 (2)');
    expect(fixYearRange('10(5)')).toBe('10 (5)');
    expect(fixYearRange('1990–1991 6(2)')).toBe('1990–1991 6 (2)');
    expect(fixYearRange('6(2) 10(5)')).toBe('6 (2) 10 (5)');
  });

  it('should handle both fixes together', () => {
    expect(fixYearRange('2025- 6(2)')).toBe('2025– 6 (2)');
    expect(fixYearRange('1990–1995 10(3)')).toBe('1990–1995 10 (3)');
  });

  it('should handle dash removal and space before parentheses together', () => {
    expect(fixYearRange('2025–6(2)')).toBe('2025–6 (2)');
  });

  it('should replace em dash with en dash', () => {
    expect(fixYearRange('1990—1991')).toBe('1990–1991');
    expect(fixYearRange('1990 — 1991')).toBe('1990–1991');
    expect(fixYearRange('[[1990]]—[[1991]]')).toBe('1990–1991');
  });

  it('should remove brackets surrounding year range', () => {
    expect(fixYearRange('[[2012–2014]]')).toBe('2012–2014');
    expect(fixYearRange('[[1990–1995]]')).toBe('1990–1995');
    expect(fixYearRange('[[2000—2005]]')).toBe('2000–2005');
    expect(fixYearRange('[[2010-2015]]')).toBe('2010–2015');
  });

  it('should handle multiple bracketed year ranges', () => {
    expect(fixYearRange('[[2012–2014]], [[2015–2017]]')).toBe('2012–2014, 2015–2017');
  });
});

describe('processTemplate', () => {
  it('should fix year parameters in football template', () => {
    const template = '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]|שנים כשחקן=1995-2000}}';
    const result = processTemplate(template, 'אישיות כדורגל');

    expect(result).toContain('שנות נוער=1990–1991');
    expect(result).toContain('שנים כשחקן=1995–2000');
  });

  it('should fix all year parameters in football template', () => {
    const template = `{{אישיות כדורגל
|שנות נוער=[[1990]] - [[1991]]
|שנים כשחקן=[[1995]] - [[2000]]
|שנים בנבחרת כשחקן=[[2001]] - [[2002]]
|שנים כמאמן=[[2010]] - [[2015]]
}}`;
    const result = processTemplate(template, 'אישיות כדורגל');

    expect(result).toContain('שנות נוער=1990–1991');
    expect(result).toContain('שנים כשחקן=1995–2000');
    expect(result).toContain('שנים בנבחרת כשחקן=2001–2002');
    expect(result).toContain('שנים כמאמן=2010–2015');
  });

  it('should fix year parameters in basketball template', () => {
    const template = '{{אישיות כדורסל|שנים כשחקן=[[1990]] - [[1991]]|שנים כמאמן=1995-2000|שנים כג\'נרל מנג\'ר=[[2000]] - [[2005]]}}';
    const result = processTemplate(template, 'אישיות כדורסל');

    expect(result).toContain('שנים כשחקן=1990–1991');
    expect(result).toContain('שנים כמאמן=1995–2000');
    expect(result).toContain('שנים כג\'נרל מנג\'ר=2000–2005');
  });

  it('should return null if no changes needed', () => {
    const template = '{{אישיות כדורגל|שנות נוער=1990–1991|שם=יוסי}}';
    const result = processTemplate(template, 'אישיות כדורגל');

    expect(result).toBeNull();
  });

  it('should return null if no year parameters present', () => {
    const template = '{{אישיות כדורגל|שם=יוסי|קבוצה=מכבי תל אביב}}';
    const result = processTemplate(template, 'אישיות כדורגל');

    expect(result).toBeNull();
  });

  it('should return null for unknown template', () => {
    const template = '{{תבנית אחרת|שנים=1990–1991}}';
    const result = processTemplate(template, 'תבנית אחרת' as TemplateName);

    expect(result).toBeNull();
  });

  it('should preserve other parameters', () => {
    const template = '{{אישיות כדורגל|שם=יוסי|שנות נוער=[[1990]] - [[1991]]|קבוצה=מכבי}}';
    const result = processTemplate(template, 'אישיות כדורגל');

    expect(result).toContain('שם=יוסי');
    expect(result).toContain('קבוצה=מכבי');
    expect(result).toContain('שנות נוער=1990–1991');
  });

  it('should handle partial fixes', () => {
    const template = '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]|שנים כשחקן=1995–2000}}';
    const result = processTemplate(template, 'אישיות כדורגל');

    expect(result).toContain('שנות נוער=1990–1991');
    expect(result).toContain('שנים כשחקן=1995–2000');
  });
});

describe('processArticle', () => {
  let api: Mocked<IWikiApi>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    api = WikiApiMock();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should process article and update template', async () => {
    const title = 'אלי אוחנה';
    const content = 'Some text {{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]}} more text';

    api.edit.mockResolvedValue({});

    const result = await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [
        {
          user: 'TestUser',
          size: content.length,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': content,
            },
          },
        },
      ],
    });

    expect(api.edit).toHaveBeenCalledWith(
      title,
      'תיקון עיצוב טווחי שנים בתבניות אישיות ספורט',
      expect.stringContaining('שנות נוער=1990–1991'),
      123,
    );
    expect(result).toStrictEqual({ title, text: `[[${title}]]` });
  });

  it('should skip articles without template', async () => {
    const title = 'Some Article';
    const content = 'Some text without template';

    const result = await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [
        {
          user: 'TestUser',
          size: content.length,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': content,
            },
          },
        },
      ],
    });

    expect(api.edit).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should not edit if template has no changes', async () => {
    const title = 'Some Article';
    const content = 'Some text {{אישיות כדורגל|שנות נוער=1990–1991}} more text';

    const result = await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [
        {
          user: 'TestUser',
          size: content.length,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': content,
            },
          },
        },
      ],
    });

    expect(api.edit).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should handle multiple templates in one article', async () => {
    const title = 'Some Article';
    const content = '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]}} {{אישיות כדורגל|שנים כשחקן=[[1995]] - [[2000]]}}';

    api.edit.mockResolvedValue({});

    const result = await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [
        {
          user: 'TestUser',
          size: content.length,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': content,
            },
          },
        },
      ],
    });

    expect(api.edit).toHaveBeenCalledWith(
      title,
      'תיקון עיצוב טווחי שנים בתבניות אישיות ספורט',
      expect.stringContaining('שנות נוער=1990–1991'),
      123,
    );
    expect(result).toStrictEqual({ title, text: `[[${title}]]` });
  });

  it('should handle where is no content', async () => {
    const title = 'Some Article';
    console.log('Processing article:', title);
    const result = await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [],
    });

    expect(api.edit).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should handle basketball template', async () => {
    const title = 'Basketball Player';
    const content = 'Some text {{אישיות כדורסל|שנים כשחקן=[[1990]] - [[1991]]|שנים כמאמן=1995-2000}} more text';

    api.edit.mockResolvedValue({});

    const result = await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [
        {
          user: 'TestUser',
          size: content.length,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': content,
            },
          },
        },
      ],
    });

    expect(api.edit).toHaveBeenCalledWith(
      title,
      'תיקון עיצוב טווחי שנים בתבניות אישיות ספורט',
      expect.stringContaining('שנים כשחקן=1990–1991'),
      123,
    );
    expect(result).toStrictEqual({ title, text: `[[${title}]]` });
  });

  it('should handle both templates in one article', async () => {
    const title = 'Some Article';
    const content = '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]}} {{אישיות כדורסל|שנים כשחקן=[[1995]] - [[2000]]}}';

    api.edit.mockResolvedValue({});

    await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [
        {
          user: 'TestUser',
          size: content.length,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': content,
            },
          },
        },
      ],
    });

    expect(api.edit).toHaveBeenCalledWith(
      title,
      'תיקון עיצוב טווחי שנים בתבניות אישיות ספורט',
      expect.stringContaining('שנות נוער=1990–1991'),
      123,
    );
    expect(api.edit).toHaveBeenCalledWith(
      title,
      'תיקון עיצוב טווחי שנים בתבניות אישיות ספורט',
      expect.stringContaining('שנים כשחקן=1995–2000'),
      123,
    );
  });

  it('should handle errors gracefully', async () => {
    const title = 'Error Article';

    api.edit.mockRejectedValue(new Error('API Error'));

    const result = await processArticle(api, {
      title,
      pageid: 1,
      ns: 0,
      extlinks: [],
      revisions: [
        {
          user: 'TestUser',
          size: 100,
          revid: 123,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]}}',
            },
          },
        },
      ],
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update'),
      expect.any(Error),
    );
    expect(result).toStrictEqual({ title, text: `[[${title}]]`, error: true });
  });
});

describe('sportPersonalityTemplatesYearsFormatModel', () => {
  let mockApi: Mocked<IWikiApi>;

  beforeEach(() => {
    mockApi = WikiApiMock();
  });

  it('should process all articles with template', async () => {
    const pages: WikiPage[] = [
      {
        title: 'אלי אוחנה',
        pageid: 1,
        ns: 0,
        extlinks: [],
        revisions: [
          {
            user: 'TestUser',
            size: 100,
            revid: 123,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]}}',
              },
            },
          },
        ],
      },
      {
        title: 'יוסי בניון',
        pageid: 2,
        ns: 0,
        extlinks: [],
        revisions: [
          {
            user: 'TestUser',
            size: 100,
            revid: 456,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{אישיות כדורגל|שנים כשחקן=[[1995]] - [[2000]]}}',
              },
            },
          },
        ],
      },
    ];

    mockApi.login.mockResolvedValue(undefined);
    mockApi.edit.mockResolvedValue({});

    async function* mockGenerator() {
      yield pages;
    }
    mockApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());

    const { default: footballYearsFormat } = await import('../sportPersonalityTemplatesYearsFormat/model');
    await footballYearsFormat(mockApi);

    expect(mockApi.login).toHaveBeenCalledWith();
    expect(mockApi.getArticlesWithTemplate).toHaveBeenCalledWith('אישיות כדורגל');
    expect(mockApi.edit).toHaveBeenCalledWith(
      'אלי אוחנה',
      'תיקון עיצוב טווחי שנים בתבניות אישיות ספורט',
      expect.stringContaining('שנות נוער=1990–1991'),
      123,
    );
  });

  it('should process articles from both templates', async () => {
    const footballPages: WikiPage[] = [
      {
        title: 'אלי אוחנה',
        pageid: 1,
        ns: 0,
        extlinks: [],
        revisions: [
          {
            user: 'TestUser',
            size: 100,
            revid: 123,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]}}',
              },
            },
          },
        ],
      },
    ];
    const basketballPages: WikiPage[] = [
      {
        title: 'יוסי בניון',
        pageid: 2,
        ns: 0,
        extlinks: [],
        revisions: [
          {
            user: 'TestUser',
            size: 100,
            revid: 456,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{אישיות כדורסל|שנים כשחקן=[[1995]] - [[2000]]}}',
              },
            },
          },
        ],
      },
    ];

    mockApi.login.mockResolvedValue(undefined);
    mockApi.edit.mockResolvedValue({});

    async function* footballGenerator() {
      yield footballPages;
    }
    async function* basketballGenerator() {
      yield basketballPages;
    }

    mockApi.getArticlesWithTemplate
      .mockReturnValueOnce(footballGenerator())
      .mockReturnValueOnce(basketballGenerator());

    const { default: footballYearsFormat } = await import('../sportPersonalityTemplatesYearsFormat/model');
    await footballYearsFormat(mockApi);

    expect(mockApi.getArticlesWithTemplate).toHaveBeenCalledWith('אישיות כדורגל');
    expect(mockApi.getArticlesWithTemplate).toHaveBeenCalledWith('אישיות כדורסל');
    expect(mockApi.edit).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Number),
    );
  });

  it('should handle empty results', async () => {
    mockApi.login.mockResolvedValue(undefined);

    async function* mockGenerator() {
      // Empty generator
    }
    mockApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());

    const { default: footballYearsFormat } = await import('../sportPersonalityTemplatesYearsFormat/model');
    const result = await footballYearsFormat(mockApi);

    expect(mockApi.login).toHaveBeenCalledWith();
    expect(mockApi.getArticlesWithTemplate).toHaveBeenCalledWith('אישיות כדורגל');
    expect(result).toStrictEqual({ processedCount: 0, logs: [] });
  });

  it('should create WikiApi instance when not provided', async () => {
    const { default: footballYearsFormat } = await import('../sportPersonalityTemplatesYearsFormat/model');

    await expect(footballYearsFormat(undefined)).rejects.toThrow('Missing username or password');
  });

  it('should log errors when there are failed articles', async () => {
    const title = 'Error Article';
    const pages: WikiPage[] = [
      {
        title,
        pageid: 1,
        ns: 0,
        extlinks: [],
        revisions: [
          {
            user: 'TestUser',
            size: 100,
            revid: 123,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{אישיות כדורגל|שנות נוער=[[1990]] - [[1991]]}}',
              },
            },
          },
        ],
      },
    ];

    mockApi.login.mockResolvedValue(undefined);
    mockApi.edit.mockRejectedValue(new Error('API Error'));

    async function* mockGenerator() {
      yield pages;
    }
    mockApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());

    const { default: footballYearsFormat } = await import('../sportPersonalityTemplatesYearsFormat/model');
    const result = await footballYearsFormat(mockApi);

    expect(result).toStrictEqual({ processedCount: 1, logs: [{ title, text: `[[${title}]]`, error: true }] });
  });

  it('should not return log if article not changed', async () => {
    const title = 'Some Article';
    const content = 'Some text {{אישיות כדורגל|שנות נוער=1990–1991}} more text';

    mockApi.login.mockResolvedValue(undefined);

    async function* mockGenerator() {
      yield [{
        title,
        pageid: 1,
        ns: 0,
        extlinks: [],
        revisions: [
          {
            user: 'TestUser',
            size: content.length,
            revid: 123,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': content,
              },
            },
          },
        ],
      }];
    }
    mockApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());

    const { default: footballYearsFormat } = await import('../sportPersonalityTemplatesYearsFormat/model');
    const result = await footballYearsFormat(mockApi);

    expect(result).toStrictEqual({ processedCount: 1, logs: [] });
  });
});
