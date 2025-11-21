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
    jest.restoreAllMocks();
  });

  describe('getPagesToArchive', () => {
    it('should parse pages to archive from wiki table', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט
|-
| [[ויקיפדיה:מזנון]] || טופל,הועבר || 14 || רבעון || [[ויקיפדיה:מזנון]]
|-
| [[ויקיפדיה:בקשות]] || נפתר || 7 || תבנית ארכיון || [[ויקיפדיה:בקשות/ניווט]]
|}`;

      wikiApi.articleContent.mockResolvedValue({ content: tableContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const pages = await model.getPagesToArchive();

      expect(pages).toHaveLength(2);
      expect(pages[0]).toStrictEqual({
        page: 'ויקיפדיה:מזנון',
        statuses: ['טופל', 'הועבר'],
        daysAfterLastActivity: 14,
        archiveType: 'רבעון',
        archiveNavigatePage: 'ויקיפדיה:מזנון',
      });
      expect(pages[1]).toStrictEqual({
        page: 'ויקיפדיה:בקשות',
        statuses: ['נפתר'],
        daysAfterLastActivity: 7,
        archiveType: 'תבנית ארכיון',
        archiveNavigatePage: 'ויקיפדיה:בקשות/ניווט',
      });
    });

    it('should throw error for invalid page link', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט
|-
| InvalidPageWithoutBrackets || טופל || 14 || רבעון || [[ויקיפדיה:מזנון]]
|}`;

      wikiApi.articleContent.mockResolvedValue({ content: tableContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await expect(model.getPagesToArchive()).rejects.toThrow('Invalid page: InvalidPageWithoutBrackets');
    });

    it('should handle null archiveNavigatePage when link is invalid', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט
|-
| [[ויקיפדיה:מזנון]] || טופל || 14 || רבעון || InvalidNavigatePageWithoutBrackets
|}`;

      wikiApi.articleContent.mockResolvedValue({ content: tableContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const pages = await model.getPagesToArchive();

      expect(pages).toHaveLength(1);
      expect(pages[0].archiveNavigatePage).toBeNull();
    });
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

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

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

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

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

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

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

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

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

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

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
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר'], 7);

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

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

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

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      // Should use the valid signature and archive
      expect(result).toHaveLength(1);
    });
  });

  describe('archive', () => {
    it('should archive paragraphs to correct quarterly archive pages with custom summaries', async () => {
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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

      // Each paragraph triggers: archive page check, source page read for removal
      // Q1 Discussion
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // archive doesn't exist
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page for removal
      // Q2 Discussion
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // archive doesn't exist
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page for removal

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      // Should create two archive pages (Q1 and Q2) with custom summaries
      const createCalls = (jest.mocked(wikiApi.create)).mock.calls;

      expect(createCalls).toHaveLength(2);
      expect(createCalls[0]).toStrictEqual([
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב "Q1 Discussion", הועבר.',
        expect.stringContaining('{{ארכיון הדט}}'),
      ]);
      expect(createCalls[1]).toStrictEqual([
        'TestPage/ארכיון אפריל-יוני 2025',
        'ארכוב "Q2 Discussion", טופל.',
        expect.stringContaining('{{ארכיון הדט}}'),
      ]);

      // Should edit the source page twice to remove each archived paragraph
      const sourceEdits = (jest.mocked(wikiApi.edit)).mock.calls.filter((call) => call[0] === 'TestPage');

      expect(sourceEdits).toHaveLength(2);
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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 }); // archive exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page for removal

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).toHaveBeenCalledTimes(2); // once for archive, once for source
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב "Discussion to Archive", הועבר.',
        expect.stringContaining('Old Discussion'),
        2,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב "Discussion to Archive", הועבר.',
        expect.stringContaining('Discussion to Archive'),
        2,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        'ארכוב "Discussion to Archive", הועבר.',
        expect.any(String),
        1,
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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      // Each paragraph: archive page check + source page read
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // Q1 archive
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // Q2 archive
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // Q3 archive
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // Q4 archive
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      // Verify all 4 quarterly archives were created with correct summaries
      expect(wikiApi.create).toHaveBeenCalledTimes(4);

      const createCalls = (jest.mocked(wikiApi.create)).mock.calls;

      expect(createCalls[0][0]).toBe('TestPage/ארכיון ינואר-מרץ 2025');
      expect(createCalls[0][1]).toBe('ארכוב "Q1 2025", הועבר.');
      expect(createCalls[1][0]).toBe('TestPage/ארכיון אפריל-יוני 2025');
      expect(createCalls[3][0]).toBe('TestPage/ארכיון אוקטובר-דצמבר 2025');
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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // archive check
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      // Should only archive the valid discussion
      expect(wikiApi.create).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledTimes(1);

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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // archive check
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      // Should only archive the valid discussion
      expect(wikiApi.create).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledTimes(1);

      const createCall = (jest.mocked(wikiApi.create)).mock.calls[0];

      expect(createCall[2]).toContain('Valid Discussion');
      expect(createCall[2]).not.toContain('No Date Discussion');
    });

    it('should add multiple paragraphs to the same archive page sequentially', async () => {
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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר', 'טופל'], 14);

      // Discussion 1: archive doesn't exist (create it), then edit source
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      // Discussion 2: archive now exists (append to it), then edit source
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון הדט}}\n\n==Discussion 1==\nContent', revid: 2 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      // Discussion 3: archive exists (append to it), then edit source
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון הדט}}\n\n==Discussion 1==\n==Discussion 2==', revid: 3 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      // Should create one archive page for the first paragraph
      expect(wikiApi.create).toHaveBeenCalledTimes(1);
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב "Discussion 1", הועבר.',
        expect.stringContaining('Discussion 1'),
      );

      // Should edit archive page twice for paragraphs 2 and 3
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב "Discussion 2", טופל.',
        expect.stringContaining('Discussion 2'),
        2,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב "Discussion 3", הועבר.',
        expect.stringContaining('Discussion 3'),
        3,
      );

      // Should edit source page 3 times (once per paragraph)
      expect(wikiApi.edit).toHaveBeenCalledTimes(5); // 2 archive edits + 3 source edits
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

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // archive check
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      // Check that the edited content doesn't have triple newlines
      const editCalls = (jest.mocked(wikiApi.edit)).mock.calls;
      const editCall = editCalls.find((call) => call[0] === 'TestPage');

      expect(editCall).toBeDefined();

      expect(editCall?.[2]).not.toMatch(/\n\n\n/);
    });

    it('should throw error when source page content is missing', async () => {
      wikiApi.articleContent.mockResolvedValue({ content: '', revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await expect(model.getArchivableParagraphs('TestPage', ['הועבר'], 14)).rejects.toThrow('Missing content for TestPage');
    });
  });

  describe('archive with template algorithm', () => {
    it('should archive to template-based archive page with custom summary', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
[[/ארכיון 2]]
}}
Some content
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: navigatePageContent, revid: 2 }); // navigate page
      wikiApi.info.mockResolvedValueOnce([{}]); // check archive exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון הדט}}\n\nExisting content', revid: 3 }); // archive content
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page

      await model.archive('TestPage', archivableParagraphs, 'תבנית ארכיון', 'TestPage/Navigate');

      expect(wikiApi.edit).toHaveBeenCalledTimes(2); // archive + source
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 2',
        'ארכוב "Discussion 1", הועבר.',
        expect.stringContaining('Discussion 1'),
        3,
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        'ארכוב "Discussion 1", הועבר.',
        expect.not.stringContaining('Discussion 1'),
        1,
      );
    });

    it('should create new archive page if none exists', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|טופל}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['טופל'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: navigatePageContent, revid: 2 }); // navigate page
      wikiApi.info.mockResolvedValueOnce([{}]); // check archive exists
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // archive doesn't exist
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page

      await model.archive('TestPage', archivableParagraphs, 'תבנית ארכיון', 'TestPage/Navigate');

      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        'ארכוב "Discussion 1", טופל.',
        expect.stringContaining('{{ארכיון הדט}}'),
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        'ארכוב "Discussion 1", טופל.',
        expect.any(String),
        1,
      );
    });

    it('should only use archive pages that start with the page name (matchPrefix)', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const navigatePageContent = `
{{תיבת ארכיון|
[[OtherPage/ארכיון 1]]
[[SomePage/ארכיון 2]]
[[/ארכיון 1]]
[[/ארכיון 2]]
}}
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: navigatePageContent, revid: 2 }); // navigate page
      wikiApi.info.mockResolvedValueOnce([{}]); // check archive exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון הדט}}\n\nExisting content', revid: 3 }); // archive content
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page

      await model.archive('TestPage', archivableParagraphs, 'תבנית ארכיון', 'TestPage/Navigate');

      expect(wikiApi.info).toHaveBeenCalledTimes(1);
      expect(wikiApi.info).toHaveBeenCalledWith(['TestPage/ארכיון 2']);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 2',
        'ארכוב "Discussion 1", הועבר.',
        expect.stringContaining('Discussion 1'),
        3,
      );
    });

    it('should throw error when archive template not found', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const navigatePageContent = 'No archive box template here';

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: navigatePageContent, revid: 2 });

      await expect(
        model.archive('TestPage', archivableParagraphs, 'תבנית ארכיון', 'TestPage/Navigate'),
      ).rejects.toThrow('Failed to get archive title: תיבת ארכיון לא נמצאה');
    });

    it('should throw error for unknown archive type', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      await expect(
        model.archive('TestPage', archivableParagraphs, 'invalid type' as any, 'TestPage'),
      ).rejects.toThrow('Unknown archive type: invalid type');
    });

    it('should include handler in archive summary when provided', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion with Handler==
{{מצב|טופל|משתמש:בוט}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['טופל'], 14);

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found')); // archive doesn't exist
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // source page

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      expect(wikiApi.create).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        'ארכוב "Discussion with Handler", טופל. מטפל: משתמש:בוט.',
        expect.stringContaining('Discussion with Handler'),
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        'ארכוב "Discussion with Handler", טופל. מטפל: משתמש:בוט.',
        expect.any(String),
        1,
      );
    });

    it('should skip paragraph without status template in quarterly archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      // Paragraph with date but without status template
      const paragraphWithoutTemplate = `
==Discussion Without Template==
Discussion content without template
First signature: 10:00, 1 בפברואר 2025 (IDT)
More content
`;

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

      await model.archive('TestPage', [paragraphWithoutTemplate], 'רבעון', 'TestPage');

      expect(consoleWarnSpy).toHaveBeenCalledWith('No status template found for paragraph: Discussion Without Template');
      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('should skip paragraph without status template in template archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      // Paragraph with date but without status template
      const paragraphWithoutTemplate = `
==Discussion Without Template==
Discussion content without template
10:00, 1 בפברואר 2025 (IDT)
`;

      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: navigatePageContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

      await model.archive('TestPage', [paragraphWithoutTemplate], 'תבנית ארכיון', 'TestPage/Navigate');

      expect(consoleWarnSpy).toHaveBeenCalledWith('No status template found for paragraph: Discussion Without Template');
      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
