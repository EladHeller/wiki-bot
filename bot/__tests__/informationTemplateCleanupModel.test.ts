import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import informationTemplateCleanupModel, {
  processArticle,
  processTemplate,
} from '../informationTemplateCleanup/model';
import { IWikiApi } from '../wiki/WikiApi';
import { WikiPage } from '../types';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { logger } from '../utilities/logger';

function buildFilePage(title: string, content?: string, revid = 123): WikiPage {
  return {
    title,
    pageid: 1,
    ns: 6,
    extlinks: [],
    revisions: content == null ? [] : [
      {
        user: 'TestUser',
        size: content.length,
        revid,
        slots: {
          main: {
            contentmodel: 'wikitext',
            contentformat: 'text/x-wiki',
            '*': content,
          },
        },
      },
    ],
  };
}

describe('processTemplate', () => {
  it('should clear exact placeholder values in target parameters', () => {
    const template = '{{מידע|תיאור=אין|מקור=לא ידוע|יוצר=אין|תאריך יצירה=2020}}';

    const result = processTemplate(template);

    expect(result).toContain('|תיאור=');
    expect(result).toContain('|מקור=');
    expect(result).toContain('|יוצר=');
    expect(result).toContain('תאריך יצירה=2020');
  });

  it('should clear placeholders with surrounding spaces', () => {
    const template = '{{מידע|תיאור=   אין   |מקור=  לא ידוע  |יוצר=צלם}}';

    const result = processTemplate(template);

    expect(result).toContain('|תיאור=');
    expect(result).toContain('|מקור=');
    expect(result).toContain('|יוצר=צלם');
  });

  it('should not clear values when phrase appears inside longer text', () => {
    const template = '{{מידע|תיאור=אין מידע זמין|מקור=המקור לא ידוע כרגע|יוצר=לא ידוע לי}}';

    const result = processTemplate(template);

    expect(result).toBeNull();
  });

  it('should not change non-target parameters', () => {
    const template = '{{מידע|תאריך=אין|מיקום=לא ידוע}}';

    const result = processTemplate(template);

    expect(result).toBeNull();
  });

  it('should return null when there is nothing to clean', () => {
    const template = '{{מידע|תיאור=צילום מהאוויר|מקור=אתר רשמי|יוצר=פלוני}}';

    const result = processTemplate(template);

    expect(result).toBeNull();
  });
});

describe('processArticle', () => {
  let api: Mocked<IWikiApi>;
  let loggerLogErrorSpy: jest.SpiedFunction<typeof logger.logError>;

  beforeEach(() => {
    api = WikiApiMock();
    loggerLogErrorSpy = jest.spyOn(logger, 'logError').mockImplementation(() => { });
  });

  afterEach(() => {
    loggerLogErrorSpy.mockRestore();
  });

  it('should process file page and update template', async () => {
    const title = 'קובץ:Example.jpg';
    const content = 'פתיח {{מידע|תיאור=אין|מקור=אתר רשמי|יוצר=לא ידוע}} סיום';

    api.edit.mockResolvedValue({});

    const result = await processArticle(api, buildFilePage(title, content));

    expect(api.edit).toHaveBeenCalledWith(
      title,
      'ניקוי ערכי "אין" ו"לא ידוע" בתבנית מידע',
      expect.stringContaining('|תיאור='),
      123,
    );
    expect(api.edit).toHaveBeenCalledWith(
      title,
      'ניקוי ערכי "אין" ו"לא ידוע" בתבנית מידע',
      expect.stringContaining('|יוצר='),
      123,
    );
    expect(result).toStrictEqual({ title, text: `[[:${title}]]` });
  });

  it('should skip pages without relevant placeholder values', async () => {
    const title = 'קובץ:Example.jpg';
    const content = 'פתיח {{מידע|תיאור=צילום|מקור=אתר רשמי|יוצר=צלם}} סיום';

    const result = await processArticle(api, buildFilePage(title, content));

    expect(api.edit).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should skip pages without content', async () => {
    const title = 'קובץ:Empty.jpg';

    const result = await processArticle(api, buildFilePage(title));

    expect(api.edit).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('should handle edit errors gracefully', async () => {
    const title = 'קובץ:Error.jpg';
    const content = '{{מידע|תיאור=אין}}';
    api.edit.mockRejectedValue(new Error('API Error'));

    const result = await processArticle(api, buildFilePage(title, content));

    expect(loggerLogErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update קובץ:Error.jpg: Error: API Error'),
    );
    expect(result).toStrictEqual({ title, text: `[[${title}]]`, error: true });
  });
});

describe('informationTemplateCleanupModel', () => {
  let mockApi: Mocked<IWikiApi>;

  beforeEach(() => {
    mockApi = WikiApiMock();
  });

  it('should process file pages with תבנית:מידע', async () => {
    const pages = [
      buildFilePage('קובץ:Example1.jpg', '{{מידע|תיאור=אין|מקור=אתר רשמי|יוצר=לא ידוע}}', 123),
      buildFilePage('קובץ:Example2.jpg', '{{מידע|תיאור=תיאור תקין|מקור=אתר רשמי|יוצר=צלם}}', 456),
    ];

    mockApi.login.mockResolvedValue(undefined);
    mockApi.edit.mockResolvedValue({});

    async function* mockGenerator() {
      yield pages;
    }
    mockApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());

    const result = await informationTemplateCleanupModel(mockApi);

    expect(mockApi.login).toHaveBeenCalledWith();
    expect(mockApi.getArticlesWithTemplate).toHaveBeenCalledWith('מידע', undefined, 'תבנית', '6');
    expect(result).toStrictEqual({
      processedCount: 2,
      logs: [{ title: 'קובץ:Example1.jpg', text: '[[:קובץ:Example1.jpg]]' }],
    });
  });

  it('should return empty logs for empty generators', async () => {
    mockApi.login.mockResolvedValue(undefined);

    async function* mockGenerator() {
      // Empty generator
    }
    mockApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());

    const result = await informationTemplateCleanupModel(mockApi);

    expect(mockApi.login).toHaveBeenCalledWith();
    expect(mockApi.getArticlesWithTemplate).toHaveBeenCalledWith('מידע', undefined, 'תבנית', '6');
    expect(result).toStrictEqual({ processedCount: 0, logs: [] });
  });

  it('should create WikiApi instance when no api provided', async () => {
    await expect(informationTemplateCleanupModel(undefined)).rejects.toThrow('Missing username or password');
  });
});
