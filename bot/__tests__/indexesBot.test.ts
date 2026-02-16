/* eslint-disable jest/no-conditional-in-test */
import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

jest.unstable_mockModule('../API/mayaAPI', () => ({
  getIndexStocks: jest.fn(),
  getIndicesList: jest.fn(),
}));

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule('../utilities/logger', () => ({
  logger: {
    logWarning: jest.fn(),
    logInfo: jest.fn(),
    logError: jest.fn(),
  },
  loggerAsyncLocalStorage: {
    run: jest.fn((store, callback: any) => callback()),
    getStore: jest.fn(),
  },
  stringify: jest.fn((msg: any) => String(msg)),
}));

const { getIndexStocks, getIndicesList } = await import('../API/mayaAPI');
const WikiApi = (await import('../wiki/WikiApi')).default;
const { logger } = await import('../utilities/logger');

const indexesBot = (await import('../indexesBot/index')).default;

describe('indexesBot validation', () => {
  let mockApi: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockApi = {
      articleContent: jest.fn(),
      edit: jest.fn(),
      purge: jest.fn(),
    };

    (jest.mocked(WikiApi)).mockReturnValue(mockApi);
    (jest.mocked(logger.logWarning)).mockImplementation(() => { });
  });

  describe('base index template validation', () => {
    it('should throw error when more than 20% of indexes are deleted', async () => {
      const oldTemplateContent = `{{#switch: {{{1}}}
| מדד 1 = חברה א • חברה ב
| מדד 2 = חברה ג • חברה ד
| מדד 3 = חברה ה • חברה ו
| מדד 4 = חברה ז • חברה ח
| מדד 5 = חברה ט • חברה י
| מדד 6 = חברה יא • חברה יב
| מדד 7 = חברה יג • חברה יד
| מדד 8 = חברה טו • חברה טז
| מדד 9 = חברה יז • חברה יח
| מדד 10 = חברה יט • חברה כ
}}`;

      const companyIndexesContent = `{{#switch: {{{1}}}
| 1 = {{תבנית1}}
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: oldTemplateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: '== מדדים נכללים ==\n[[מדד 1]]\n[[מדד 2]]',
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}} [[:קטגוריה:קטגוריה1]]\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: companyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
        'תבנית:חברות מאיה/שם מלא/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue([
        { IndexHebName: 'מדד 1', IndexId: '1', Id: '1' } as any,
        { IndexHebName: 'מדד 2', IndexId: '2', Id: '2' } as any,
      ]);

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
      ]);

      await expect(indexesBot()).rejects.toThrow(/Deleted.*of records in מדד תל אביב בסיס/);

      expect(mockApi.edit).not.toHaveBeenCalled();
    });

    it('should log warning when 10-20% of indexes are deleted', async () => {
      const oldTemplateContent = `{{#switch: {{{1}}}
| מדד 1 = חברה א
| מדד 2 = חברה ב
| מדד 3 = חברה ג
| מדד 4 = חברה ד
| מדד 5 = חברה ה
| מדד 6 = חברה ו
| מדד 7 = חברה ז
| מדד 8 = חברה ח
| מדד 9 = חברה ט
| מדד 10 = חברה י
}}`;

      const companyIndexesContent = `{{#switch: {{{1}}}
| 1 = {{תבנית1}}
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: oldTemplateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: `== מדדים נכללים ==\n${Array.from({ length: 8 }, (_, i) => `[[מדד ${i + 1}]]`).join('\n')}`,
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}}\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: companyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
        'תבנית:חברות מאיה/שם מלא/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({
          IndexHebName: `מדד ${i + 1}`,
          IndexId: `${i + 1}`,
          Id: `${i + 1}`,
        } as any)),
      );

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
      ]);

      await indexesBot();

      expect(logger.logWarning).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Deleted'),
      );
    });

    it('should succeed when less than 10% of indexes are deleted', async () => {
      const oldTemplateContent = `{{#switch: {{{1}}}
| מדד 1 = חברה א
| מדד 2 = חברה ב
| מדד 3 = חברה ג
| מדד 4 = חברה ד
| מדד 5 = חברה ה
| מדד 6 = חברה ו
| מדד 7 = חברה ז
| מדד 8 = חברה ח
| מדד 9 = חברה ט
| מדד 10 = חברה י
}}`;

      const companyIndexesContent = `{{#switch: {{{1}}}
| 1 = {{תבנית1}}
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: oldTemplateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: `== מדדים נכללים ==\n${Array.from({ length: 10 }, (_, i) => `[[מדד ${i + 1}]]`).join('\n')}`,
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}}\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: companyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
        'תבנית:חברות מאיה/שם מלא/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          IndexHebName: `מדד ${i + 1}`,
          IndexId: `${i + 1}`,
          Id: `${i + 1}`,
        } as any)),
      );

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
      ]);

      await indexesBot();

      expect(logger.logWarning).not.toHaveBeenCalled();
    });
  });

  describe('company indexes template validation', () => {
    it('should throw error when more than 20% of company records are deleted', async () => {
      const baseTemplateContent = `{{#switch: {{{1}}}
| מדד 1 = חברה א
}}`;

      const oldCompanyIndexesContent = `{{#switch: {{{1}}}
| 1 = {{תבנית1}}
| 2 = {{תבנית1}}
| 3 = {{תבנית1}}
| 4 = {{תבנית1}}
| 5 = {{תבנית1}}
| 6 = {{תבנית1}}
| 7 = {{תבנית1}}
| 8 = {{תבנית1}}
| 9 = {{תבנית1}}
| 10 = {{תבנית1}}
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: baseTemplateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: '== מדדים נכללים ==\n[[מדד 1]]',
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}} [[:קטגוריה:קטגוריה1]]\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: oldCompanyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
        'תבנית:חברות מאיה/שם מלא/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue([
        { IndexHebName: 'מדד 1', IndexId: '1', Id: '1' } as any,
      ]);

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
        {
          CompanyId: 2, ShortName: 'חברה ב', Symbol: 'SYM2', Weight: 1,
        },
      ]);

      await expect(indexesBot()).rejects.toThrow(/Deleted.*of records in מדדי הבורסה לניירות ערך בתל אביב/);

      expect(mockApi.edit).not.toHaveBeenCalled();
    });
  });

  describe('full bot flow', () => {
    it('should log "No changes" if data is identical', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
      const templateContent = `{{#switch: {{{1}}}
|מדד 1=חברה א
}}`;
      const companyIndexesContent = `{{#switch: {{{1}}}
|1={{תבנית1}} [[קטגוריה:קטגוריה1]]
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: templateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: '== מדדים נכללים ==\n[[מדד 1]]',
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}} [[:קטגוריה:קטגוריה1]]\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: companyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
        'תבנית:חברות מאיה/שם מלא/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue([
        { IndexHebName: 'מדד 1', IndexId: '1', Id: '1' } as any,
      ]);

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
      ]);

      await indexesBot();

      expect(consoleSpy).toHaveBeenCalledWith('No changes');
      expect(consoleSpy).toHaveBeenCalledWith('No changes in company indexes');

      consoleSpy.mockRestore();

      expect(mockApi.edit).not.toHaveBeenCalled();
    });

    it('should use wiki templates for company names', async () => {
      const templateContent = `{{#switch: {{{1}}}
| מדד 1 = חברה א
}}`;
      const companyIndexesContent = `{{#switch: {{{1}}}
| 1 = {{תב|תבנית1}} [[:קטגוריה:קטגוריה1]]
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: templateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: '== מדדים נכללים ==\n[[מדד 1]]',
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}} [[:קטגוריה:קטגוריה1]]\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: companyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': {
          content: `{{#switch: {{{ID}}}
| 1 = חברה א בויקי
}}`,
          revid: 127,
        },
        'תבנית:חברות מאיה/שם מלא/נתונים': {
          content: `{{#switch: {{{ID}}}
| 2 = חברה 2 מלא
}}`,
          revid: 127,
        },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue([
        { IndexHebName: 'מדד 1', IndexId: '1', Id: '1' } as any,
      ]);

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
        {
          CompanyId: 2, ShortName: 'חברה 2', Symbol: 'SYM2', Weight: 1,
        },
      ]);

      await indexesBot();

      expect(mockApi.edit).toHaveBeenCalledTimes(2);

      const baseIndexCall = mockApi.edit.mock.calls.find((call: any[]) => call[0] === 'תבנית:מדד תל אביב בסיס/נתונים');

      expect(baseIndexCall).toBeDefined();
      expect(baseIndexCall[2]).toContain('[[חברה א בויקי]]');
      expect(baseIndexCall[2]).toContain('חברה 2 מלא');
    });

    it('should throw error handling missing relevant indexes paragraph', async () => {
      mockApi.articleContent.mockResolvedValue({
        content: 'No paragraph',
      });

      await expect(indexesBot()).rejects.toThrow('Can not find supported indexes paragraph');
    });

    it('should throw error handling missing content', async () => {
      mockApi.articleContent.mockResolvedValue({});

      await expect(indexesBot()).rejects.toThrow('Failed to get template content');
    });

    it('should proceed update if old data is empty', async () => {
      const templateContent = `{{#switch: {{{1}}}
}}`;
      const companyIndexesContent = `{{#switch: {{{1}}}
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: templateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: '== מדדים נכללים ==\n[[מדד 1]]',
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}} [[:קטגוריה:קטגוריה1]]\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: companyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
        'תבנית:חברות מאיה/שם מלא/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue([
        { IndexHebName: 'מדד 1', IndexId: '1', Id: '1' } as any,
      ]);

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
      ]);

      await indexesBot();

      expect(mockApi.edit).toHaveBeenCalledTimes(2);
    });

    it('should ignore irrelevant indexes', async () => {
      const templateContent = `{{#switch: {{{1}}}
|מדד 1=חברה א
}}`;
      const companyIndexesContent = `{{#switch: {{{1}}}
|1={{תבנית1}} [[קטגוריה:קטגוריה1]]
}}`;

      const pageResponses: Record<string, { content: string; revid: number }> = {
        'תבנית:מדד תל אביב בסיס/נתונים': { content: templateContent, revid: 123 },
        'תבנית:מדד תל אביב בסיס': {
          content: '== מדדים נכללים ==\n[[מדד 1]]',
          revid: 124,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב': {
          content: '{|\n| מדד 1 || {{תב|תבנית1}} [[:קטגוריה:קטגוריה1]]\n|}',
          revid: 125,
        },
        'תבנית:מדדי הבורסה לניירות ערך בתל אביב/נתונים': { content: companyIndexesContent, revid: 126 },
        'תבנית:חברות מאיה/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
        'תבנית:חברות מאיה/שם מלא/נתונים': { content: '{{#switch: {{{ID}}}}}', revid: 127 },
      };

      mockApi.articleContent.mockImplementation((page: string) => Promise.resolve(
        pageResponses[page] || { content: '', revid: 0 },
      ));

      (jest.mocked(getIndicesList)).mockResolvedValue([
        { IndexHebName: 'מדד 1', Id: '1' } as any,
        { IndexHebName: 'מדד לא רלוונטי', IndexId: '2', Id: '2' } as any,
      ]);

      (jest.mocked(getIndexStocks)).mockResolvedValue([
        {
          CompanyId: 1, ShortName: 'חברה א', Symbol: 'SYM1', Weight: 1,
        },
      ]);

      await indexesBot();

      expect(mockApi.edit).not.toHaveBeenCalled();
      expect(getIndexStocks).toHaveBeenCalledTimes(1);
    });
  });
});
