import {
  describe, expect, it, jest,
} from '@jest/globals';
import removeCategoriesFromSingleAlbum, {
  extractYearFromDate,
  getReleaseYearFromTemplate,
  getReleaseYearFromWikidata,
  removeCategoryLine,
  processSingleTemplate,
  processAlbumTemplate,
  processArticle,
} from '../scripts/removeCategoriesFromSingleAlbum/model';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import WikiDataApiMock from '../../testConfig/mocks/wikiDataApi.mock';
import { WikiPage } from '../types';

describe('extractYearFromDate', () => {
  it('should extract year from simple year string', () => {
    expect(extractYearFromDate('2024')).toBe('2024');
  });

  it('should extract year from linked year', () => {
    expect(extractYearFromDate('[[2024]]')).toBe('2024');
  });

  it('should extract year from full date', () => {
    expect(extractYearFromDate('23 בפברואר 2024')).toBe('2024');
  });

  it('should extract year from linked full date', () => {
    expect(extractYearFromDate('[[23 בפברואר]] [[2024]]')).toBe('2024');
  });

  it('should return null for invalid date', () => {
    expect(extractYearFromDate('')).toBeNull();
    expect(extractYearFromDate('invalid')).toBeNull();
  });
});

describe('getReleaseYearFromTemplate', () => {
  it('should extract year from template data', () => {
    const templateData = { 'יצא לאור': '2024' };

    expect(getReleaseYearFromTemplate(templateData)).toBe('2024');
  });

  it('should return null if no release date', () => {
    const templateData = {};

    expect(getReleaseYearFromTemplate(templateData)).toBeNull();
  });
});

describe('removeCategoryLine', () => {
  it('should remove category line', () => {
    const content = 'Some text\n[[קטגוריה:שירי 2024]]\nMore text';
    const result = removeCategoryLine(content, 'שירי 2024');

    expect(result).toBe('Some text\nMore text');
  });

  it('should remove multiple occurrences', () => {
    const content = '[[קטגוריה:שירי 2024]]\nText\n[[קטגוריה:שירי 2024]]';
    const result = removeCategoryLine(content, 'שירי 2024');

    expect(result).toBe('Text\n');
  });

  it('should not change content if category not found', () => {
    const content = 'Some text\n[[קטגוריה:אחר]]\nMore text';
    const result = removeCategoryLine(content, 'שירי 2024');

    expect(result).toBe(content);
  });

  it('should handle special regex characters in category name', () => {
    const content = 'Text\n[[קטגוריה:test (special) [chars]]]\nMore';
    const result = removeCategoryLine(content, 'test (special) [chars]');

    expect(result).toBe('Text\nMore');
  });
});

describe('processSingleTemplate', () => {
  it('should remove categories for single without type', () => {
    const templateData = {};
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).not.toContain('[[קטגוריה:סינגלים מ-2024]]');
  });

  it('should skip if ללא קטגוריה is כן', () => {
    const templateData = { 'ללא קטגוריה': 'כן' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).toBe(content);
  });

  it('should remove only songs category if type is not single', () => {
    const templateData = { סוג: 'אחר' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).toContain('[[קטגוריה:סינגלים מ-2024]]');
  });

  it('should remove both categories if type is סינגל', () => {
    const templateData = { סוג: 'סינגל' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).not.toContain('[[קטגוריה:סינגלים מ-2024]]');
  });

  it('should remove both categories if type is שיר אירוויזיון', () => {
    const templateData = { סוג: 'שיר אירוויזיון' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).not.toContain('[[קטגוריה:סינגלים מ-2024]]');
  });
});

describe('processAlbumTemplate', () => {
  it('should remove albums category', () => {
    const templateData = {};
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
  });

  it('should skip if ללא קטגוריה is כן', () => {
    const templateData = { 'ללא קטגוריה': 'כן' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).toBe(content);
  });

  it('should remove EP category for EP type', () => {
    const templateData = { סוג: 'EP' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:מיני-אלבומים מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:מיני-אלבומים מ-2024]]');
  });

  it('should remove live album category for הופעה type', () => {
    const templateData = { סוג: 'הופעה' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי הופעה מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי הופעה מ-2024]]');
  });

  it('should remove compilation category for אוסף type', () => {
    const templateData = { סוג: 'אוסף' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי אוסף מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי אוסף מ-2024]]');
  });

  it('should remove soundtrack category for פסקול type', () => {
    const templateData = { סוג: 'פסקול' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:פסקולים מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:פסקולים מ-2024]]');
  });

  it('should remove mini-album category for מיני-אלבום type', () => {
    const templateData = { סוג: 'מיני-אלבום' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:מיני-אלבומים מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:מיני-אלבומים מ-2024]]');
  });

  it('should remove live album category for אלבום הופעה type', () => {
    const templateData = { סוג: 'אלבום הופעה' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי הופעה מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי הופעה מ-2024]]');
  });

  it('should remove compilation category for אלבום אוסף type', () => {
    const templateData = { סוג: 'אלבום אוסף' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי אוסף מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי אוסף מ-2024]]');
  });

  it('should remove compilation category for מארז תקליטורים type', () => {
    const templateData = { סוג: 'מארז תקליטורים' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי אוסף מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי אוסף מ-2024]]');
  });

  it('should remove compilation category for אלבום להיטים type', () => {
    const templateData = { סוג: 'אלבום להיטים' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי אוסף מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי אוסף מ-2024]]');
  });

  it('should remove compilation category for להיטים type', () => {
    const templateData = { סוג: 'להיטים' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי אוסף מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי אוסף מ-2024]]');
  });

  it('should remove mixtape category for מיקסטייפ type', () => {
    const templateData = { סוג: 'מיקסטייפ' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:מיקסטייפים מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:מיקסטייפים מ-2024]]');
  });

  it('should remove remix category for רמיקס type', () => {
    const templateData = { סוג: 'רמיקס' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי רמיקס מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי רמיקס מ-2024]]');
  });

  it('should remove video category for וידאו type', () => {
    const templateData = { סוג: 'וידאו' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי וידאו מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי וידאו מ-2024]]');
  });

  it('should not remove type-specific category if type is not in mapping', () => {
    const templateData = { סוג: 'unknown-type' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אחר מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).toContain('[[קטגוריה:אחר מ-2024]]');
  });
});

describe('getReleaseYearFromWikidata', () => {
  it('should extract year from wikidata claim with time object', async () => {
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([
        {
          mainsnak: {
            datavalue: {
              value: {
                time: '+2024-01-01T00:00:00Z',
              },
            },
          },
        },
      ]) as any,
    });

    const year = await getReleaseYearFromWikidata('Q123', mockWikiDataApi);

    expect(year).toBe('2024');
  });

  it('should extract year from wikidata claim with string value', async () => {
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([
        {
          mainsnak: {
            datavalue: {
              value: '2024',
            },
          },
        },
      ]) as any,
    });

    const year = await getReleaseYearFromWikidata('Q123', mockWikiDataApi);

    expect(year).toBe('2024');
  });

  it('should return null if no claims', async () => {
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([]) as any,
    });

    const year = await getReleaseYearFromWikidata('Q123', mockWikiDataApi);

    expect(year).toBeNull();
  });

  it('should return null if no datavalue', async () => {
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([
        {
          mainsnak: {},
        },
      ]) as any,
    });

    const year = await getReleaseYearFromWikidata('Q123', mockWikiDataApi);

    expect(year).toBeNull();
  });

  it('should return null if datavalue is not string or object with time', async () => {
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([
        {
          mainsnak: {
            datavalue: {
              value: 12345,
            },
          },
        },
      ]) as any,
    });

    const year = await getReleaseYearFromWikidata('Q123', mockWikiDataApi);

    expect(year).toBeNull();
  });

  it('should return null if object without time property', async () => {
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([
        {
          mainsnak: {
            datavalue: {
              value: {
                somethingElse: 'value',
              },
            },
          },
        },
      ]) as any,
    });

    const year = await getReleaseYearFromWikidata('Q123', mockWikiDataApi);

    expect(year).toBeNull();
  });

  it('should return null and log on error', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>()
        .mockRejectedValue(new Error('API Error')) as any,
    });

    const year = await getReleaseYearFromWikidata('Q123', mockWikiDataApi);

    expect(year).toBeNull();

    expect(consoleSpy).toHaveBeenCalledWith('Failed to get wikidata claim for Q123');
  });
});

describe('processArticle', () => {
  it('should process single template and update article', async () => {
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn() as any,
      edit: jest.fn<(articleTitle: string, summary: string, content: string, baseRevId: number) => Promise<any>>()
        .mockResolvedValue({}) as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Song',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{סינגל|יצא לאור=2024}}\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toStrictEqual({ title: 'Test Song', text: '[[Test Song]]' });

    expect(mockApi.edit).toHaveBeenCalledWith(
      'Test Song',
      'הסרת קטגוריות שנוספות אוטומטית מהתבנית',
      '{{סינגל|יצא לאור=2024}}\n',
      100,
    );
  });

  it('should process album template and update article', async () => {
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn() as any,
      edit: jest.fn<(articleTitle: string, summary: string, content: string, baseRevId: number) => Promise<any>>()
        .mockResolvedValue({}) as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Album',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 200,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{אלבום|יצא לאור=2024|סוג=EP}}\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:מיני-אלבומים מ-2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toStrictEqual({ title: 'Test Album', text: '[[Test Album]]' });

    expect(mockApi.edit).toHaveBeenCalledWith(
      'Test Album',
      'הסרת קטגוריות שנוספות אוטומטית מהתבנית',
      '{{אלבום|יצא לאור=2024|סוג=EP}}\n',
      200,
    );
  });

  it('should get year from wikidata if not in template', async () => {
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn<(title: string) => Promise<string | undefined>>()
        .mockResolvedValue('Q123') as any,
      edit: jest.fn<(articleTitle: string, summary: string, content: string, baseRevId: number) => Promise<any>>()
        .mockResolvedValue({}) as any,
    });
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([
        {
          mainsnak: {
            datavalue: {
              value: {
                time: '+2024-01-01T00:00:00Z',
              },
            },
          },
        },
      ]) as any,
    });

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Song',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{סינגל}}\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toStrictEqual({ title: 'Test Song', text: '[[Test Song]]' });

    expect(mockApi.getWikiDataItem).toHaveBeenCalledWith('Test Song');

    expect(mockWikiDataApi.getClaim).toHaveBeenCalledWith('Q123', 'P577');
  });

  it('should get year for album from wikidata if not in template', async () => {
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn<(title: string) => Promise<string | undefined>>()
        .mockResolvedValue('Q123') as any,
      edit: jest.fn<(articleTitle: string, summary: string, content: string, baseRevId: number) => Promise<any>>()
        .mockResolvedValue({}) as any,
    });
    const mockWikiDataApi = WikiDataApiMock({
      getClaim: jest.fn<(entity: string, property: string) => Promise<any>>().mockResolvedValue([
        {
          mainsnak: {
            datavalue: {
              value: {
                time: '+2024-01-01T00:00:00Z',
              },
            },
          },
        },
      ]) as any,
    });

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Album',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{אלבום}}\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:מיני-אלבומים מ-2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toStrictEqual({ title: 'Test Album', text: '[[Test Album]]' });

    expect(mockApi.getWikiDataItem).toHaveBeenCalledWith('Test Album');

    expect(mockWikiDataApi.getClaim).toHaveBeenCalledWith('Q123', 'P577');
  });

  it('should return null if no release year found', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn<(title: string) => Promise<string | undefined>>()
        .mockResolvedValue(undefined) as any,
      edit: jest.fn() as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Song',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{סינגל}}\n[[קטגוריה:שירי 2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toBeNull();

    expect(mockApi.edit).not.toHaveBeenCalled();

    expect(consoleSpy).toHaveBeenCalledWith('No release year found for single in Test Song');
  });

  it('should return null if no release year found for album', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn<(title: string) => Promise<string | undefined>>()
        .mockResolvedValue(undefined) as any,
      edit: jest.fn() as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Album',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{אלבום}}\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:מיני-אלבומים מ-2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toBeNull();

    expect(mockApi.edit).not.toHaveBeenCalled();

    expect(consoleSpy).toHaveBeenCalledWith('No release year found for album in Test Album');
  });

  it('should return null if no changes needed', async () => {
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn() as any,
      edit: jest.fn() as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Song',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{סינגל|יצא לאור=2024|ללא קטגוריה=כן}}\n[[קטגוריה:שירי 2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toBeNull();

    expect(mockApi.edit).not.toHaveBeenCalled();
  });

  it('should return null if no content', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockApi = WikiApiMock();
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Song',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
            } as any,
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith('No content or revid for Test Song');
  });

  it('should return null if no revid', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockApi = WikiApiMock();
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Song',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': 'content',
            },
          },
        } as any,
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith('No content or revid for Test Song');
  });

  it('should return error log on exception', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn() as any,
      edit: jest.fn<(articleTitle: string, summary: string, content: string, baseRevId: number) => Promise<any>>()
        .mockRejectedValue(new Error('API Error')) as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Song',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{סינגל|יצא לאור=2024}}\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toStrictEqual({ title: 'Test Song', text: '[[Test Song]]', error: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith('⚠️ Failed to update Test Song', expect.any(Error));
  });

  it('should process multiple templates in same article', async () => {
    const mockApi = WikiApiMock({
      getWikiDataItem: jest.fn() as any,
      edit: jest.fn<(articleTitle: string, summary: string, content: string, baseRevId: number) => Promise<any>>()
        .mockResolvedValue({}) as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: 'Test Page',
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid: 100,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': '{{סינגל|יצא לאור=2024}}\n{{אלבום|יצא לאור=2023}}\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\n[[קטגוריה:אלבומי 2023]]',
            },
          },
        },
      ],
    };

    const result = await processArticle(mockApi, mockWikiDataApi, page);

    expect(result).toStrictEqual({ title: 'Test Page', text: '[[Test Page]]' });

    expect(mockApi.edit).toHaveBeenCalledWith(
      'Test Page',
      'הסרת קטגוריות שנוספות אוטומטית מהתבנית',
      '{{סינגל|יצא לאור=2024}}\n{{אלבום|יצא לאור=2023}}\n',
      100,
    );
  });
});

describe('removeCategoriesFromSingleAlbum', () => {
  it('should process all singles and albums', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});

    async function* mockSinglesGenerator(): AsyncGenerator<WikiPage[], void, void> {
      yield [{
        pageid: 1,
        ns: 0,
        title: 'Single 1',
        extlinks: [],
        revisions: [
          {
            user: 'test',
            size: 100,
            revid: 100,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{סינגל|יצא לאור=2024}}\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]',
              },
            },
          },
        ],
      }];
    }

    async function* mockAlbumsGenerator(): AsyncGenerator<WikiPage[], void, void> {
      yield [{
        pageid: 2,
        ns: 0,
        title: 'Album 1',
        extlinks: [],
        revisions: [
          {
            user: 'test',
            size: 100,
            revid: 200,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{אלבום|יצא לאור=2024}}\n[[קטגוריה:אלבומי 2024]]',
              },
            },
          },
        ],
      }];
    }

    const mockApi = WikiApiMock({
      getArticlesWithTemplate: jest.fn<() => AsyncGenerator<WikiPage[], void, void>>()
        .mockReturnValueOnce(mockSinglesGenerator())
        .mockReturnValueOnce(mockAlbumsGenerator()) as any,
      getWikiDataItem: jest.fn() as any,
      edit: jest.fn<(articleTitle: string, summary: string, content: string, baseRevId: number) => Promise<any>>()
        .mockResolvedValue({}) as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const result = await removeCategoriesFromSingleAlbum(mockApi, mockWikiDataApi);

    expect(result.processedCount).toBe(2);

    expect(result.logs).toHaveLength(2);

    expect(result.logs[0]).toStrictEqual({ title: 'Single 1', text: '[[Single 1]]' });

    expect(result.logs[1]).toStrictEqual({ title: 'Album 1', text: '[[Album 1]]' });
  });

  it('should handle articles with no changes', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});

    async function* mockSinglesGenerator(): AsyncGenerator<WikiPage[], void, void> {
      yield [{
        pageid: 1,
        ns: 0,
        title: 'Single 1',
        extlinks: [],
        revisions: [
          {
            user: 'test',
            size: 100,
            revid: 100,
            slots: {
              main: {
                contentmodel: 'wikitext',
                contentformat: 'text/x-wiki',
                '*': '{{סינגל|יצא לאור=2024|ללא קטגוריה=כן}}\n[[קטגוריה:שירי 2024]]',
              },
            },
          },
        ],
      }];
    }

    async function* mockAlbumsGenerator(): AsyncGenerator<WikiPage[], void, void> {
      // Empty generator
    }

    const mockApi = WikiApiMock({
      getArticlesWithTemplate: jest.fn<() => AsyncGenerator<WikiPage[], void, void>>()
        .mockReturnValueOnce(mockSinglesGenerator())
        .mockReturnValueOnce(mockAlbumsGenerator()) as any,
      getWikiDataItem: jest.fn() as any,
      edit: jest.fn() as any,
    });
    const mockWikiDataApi = WikiDataApiMock();

    const result = await removeCategoriesFromSingleAlbum(mockApi, mockWikiDataApi);

    expect(result.processedCount).toBe(1);

    expect(result.logs).toHaveLength(0);

    expect(mockApi.edit).not.toHaveBeenCalled();
  });
});
