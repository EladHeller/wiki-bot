import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import ClosedDiscussionsArchiveBotModel, { IClosedDiscussionsArchiveBotModel } from '../maintenance/closedDiscussionsArchiveBot/ClosedDiscussionsArchiveBotModel';
import { IWikiApi } from '../wiki/WikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('closedDiscussionsArchiveBotModel', () => {
  let model: IClosedDiscussionsArchiveBotModel;
  let wikiApi: Mocked<IWikiApi>;
  const fakerTimers = jest.useFakeTimers();

  beforeEach(() => {
    wikiApi = WikiApiMock();
  });

  afterEach(() => {
    jest.setSystemTime(jest.getRealSystemTime());
  });

  describe('getArchivableParagraphs', () => {
    it('should return paragraphs with valid status and old signatures', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Some discussion content
12:42, 1 בינואר 2025 (IDT)
More content

==Discussion 2==
{{מצב|טופל}}
Another discussion
09:00, 15 בינואר 2025 (IDT)

==Discussion 3==
{{מצב|פתוח}}
This should not be archived
10:00, 1 בינואר 2025 (IDT)

==Discussion 4==
{{מצב|הועבר}}
This is too recent
23:59, 25 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage');

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('Discussion 1');
      expect(result[0]).toContain('הועבר');
      expect(result[1]).toContain('Discussion 2');
      expect(result[1]).toContain('טופל');
    });

    it('should return empty array when no archivable paragraphs', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|פתוח}}
Still open
12:42, 1 בינואר 2025 (IDT)

==Discussion 2==
{{מצב|הועבר}}
Too recent
23:59, 20 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage');

      expect(result).toHaveLength(0);
    });

    it('should not archive paragraphs without status template', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
No status template here
12:42, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage');

      expect(result).toHaveLength(0);
    });

    it('should not archive paragraphs with empty status template', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב}}
Empty status template
12:42, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage');

      expect(result).toHaveLength(0);
    });

    it('should not archive paragraphs without signatures', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
No signature here
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage');

      expect(result).toHaveLength(0);
    });

    it('should use custom inactivity days', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Discussion content
12:42, 25 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi, 7);

      const result = await model.getArchivableParagraphs('TestPage');

      expect(result).toHaveLength(1);
    });

    it('should handle multiple signatures and use the last one', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
First signature: 10:00, 1 בינואר 2025 (IDT)
Second signature: 12:00, 2 בינואר 2025 (IDT)
Last signature: 15:00, 20 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage');

      // Last signature is Jan 20, only 12 days old, should not be archived
      expect(result).toHaveLength(0);
    });

    it('should handle invalid month names in signatures', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Valid signature: 10:00, 1 בינואר 2025 (IDT)
Invalid month: 12:00, 5 בטעות 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage');

      // Should use the valid signature and archive
      expect(result).toHaveLength(1);
    });
  });

  describe('archive', () => {
    it('should archive paragraphs to correct quarterly archive pages', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Q1 Discussion==
{{מצב|הועבר}}
First quarter discussion
10:00, 1 בפברואר 2025 (IDT)
Reply: 12:00, 2 בפברואר 2025 (IDT)

==Q2 Discussion==
{{מצב|טופל}}
Second quarter discussion
15:00, 1 באפריל 2025 (IDT)
Reply: 16:00, 2 באפריל 2025 (IDT)

==Recent Discussion==
{{מצב|הועבר}}
Too recent
23:59, 25 ביוני 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      // Mock getContentOrNull calls (archive pages don't exist)
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      // Mock final getContent call for source page
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs);

      // Should create two archive pages (Q1 and Q2)
      expect(wikiApi.create).toHaveBeenCalledTimes(2);
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('{{ארכיון הדט}}'),
      );
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון אפריל-יוני 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('{{ארכיון הדט}}'),
      );

      // Should edit the source page to remove archived paragraphs
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('Recent Discussion'),
        1,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        'ארכוב דיונים שהסתיימו',
        expect.not.stringContaining('Q1 Discussion'),
        1,
      );
    });

    it('should append to existing archive pages', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion to Archive==
{{מצב|הועבר}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const existingArchiveContent = `{{ארכיון הדט}}

==Old Discussion==
Old content`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      // Mock existing archive page
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 });
      // Mock final getContent call for source page
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs);

      // Should edit existing archive page, not create
      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('Old Discussion'),
        2,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('Discussion to Archive'),
        2,
      );
    });

    it('should not archive when no archivable paragraphs', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Recent Discussion==
{{מצב|הועבר}}
Too recent
23:59, 25 ביוני 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      await model.archive('TestPage', archivableParagraphs);

      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
    });

    it('should handle different quarters correctly', async () => {
      fakerTimers.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const pageContent = `
==Q1 2025==
{{מצב|הועבר}}
Q1 discussion
10:00, 15 בינואר 2025 (IDT)

==Q2 2025==
{{מצב|הועבר}}
Q2 discussion
10:00, 15 באפריל 2025 (IDT)

==Q3 2025==
{{מצב|הועבר}}
Q3 discussion
10:00, 15 ביולי 2025 (IDT)

==Q4 2025==
{{מצב|הועבר}}
Q4 discussion
10:00, 15 באוקטובר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      // All archive pages don't exist
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs);

      expect(wikiApi.create).toHaveBeenCalledTimes(4);
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('Q1 2025'),
      );
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון אפריל-יוני 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('Q2 2025'),
      );
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון יולי-ספטמבר 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('Q3 2025'),
      );
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון אוקטובר-דצמבר 2025',
        'ארכוב דיונים שהסתיימו',
        expect.stringContaining('Q4 2025'),
      );
    });

    it('should skip paragraphs without valid dates during archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Valid Discussion==
{{מצב|הועבר}}
Valid discussion
10:00, 1 בפברואר 2025 (IDT)

==Invalid Date Discussion==
{{מצב|טופל}}
This has an unparseable date
10:00, 1 בInvalidMonth 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs);

      // Should only archive the valid discussion
      expect(wikiApi.create).toHaveBeenCalledTimes(1);

      const createCall = (jest.mocked(wikiApi.create)).mock.calls[0];

      expect(createCall[2]).toContain('Valid Discussion');
      expect(createCall[2]).not.toContain('Invalid Date Discussion');
    });

    it('should skip paragraphs with no parseable dates at all', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Valid Discussion==
{{מצב|הועבר}}
Valid discussion
10:00, 1 בפברואר 2025 (IDT)

==No Date Discussion==
{{מצב|טופל}}
This has no date at all, just text
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs);

      // Should only archive the valid discussion
      expect(wikiApi.create).toHaveBeenCalledTimes(1);

      const createCall = (jest.mocked(wikiApi.create)).mock.calls[0];

      expect(createCall[2]).toContain('Valid Discussion');
      expect(createCall[2]).not.toContain('No Date Discussion');
    });

    it('should group multiple paragraphs to the same archive page', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
First discussion
10:00, 1 בפברואר 2025 (IDT)

==Discussion 2==
{{מצב|טופל}}
Second discussion
11:00, 5 בפברואר 2025 (IDT)

==Discussion 3==
{{מצב|הועבר}}
Third discussion
12:00, 10 בפברואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs);

      // Should create only one archive page for all three paragraphs (same quarter)
      expect(wikiApi.create).toHaveBeenCalledTimes(1);

      const createCall = (jest.mocked(wikiApi.create)).mock.calls[0];

      expect(createCall[0]).toBe('TestPage/ארכיון ינואר-מרץ 2025');
      expect(createCall[2]).toContain('Discussion 1');
      expect(createCall[2]).toContain('Discussion 2');
      expect(createCall[2]).toContain('Discussion 3');
    });

    it('should clean up multiple newlines in source page', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `==Discussion 1==
{{מצב|הועבר}}
Content
10:00, 1 בפברואר 2025 (IDT)

==Discussion 2==
Still active content

==Discussion 3==
More content`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage');

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs);

      // Check that the edited content doesn't have triple newlines
      const editCalls = (jest.mocked(wikiApi.edit)).mock.calls;
      const editCall = editCalls.find((call) => call[0] === 'TestPage');

      expect(editCall).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(editCall![2]).not.toMatch(/\n\n\n/);
    });

    it('should throw error when source page content is missing', async () => {
      wikiApi.articleContent.mockResolvedValue({ content: '', revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await expect(model.getArchivableParagraphs('TestPage')).rejects.toThrow('Missing content for TestPage');
    });
  });
});
