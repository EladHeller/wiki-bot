import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import ClosedDiscussionsArchiveBotModel, { IClosedDiscussionsArchiveBotModel } from '../maintenance/closedDiscussionsArchiveBot/ClosedDiscussionsArchiveBotModel';
import { IWikiApi } from '../wiki/WikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { logger } from '../utilities/logger';

const getMockResponse = <T>(
  responses: Record<string, T>,
  key: string,
  defaultValue: T,
): T => responses[key] || defaultValue;

describe('closedDiscussionsArchiveBotModel', () => {
  let model: IClosedDiscussionsArchiveBotModel;
  let wikiApi: Mocked<IWikiApi>;
  const fakerTimers = jest.useFakeTimers();
  let loggerLogWarningSpy: jest.SpiedFunction<typeof logger.logWarning>;

  beforeEach(() => {
    wikiApi = WikiApiMock();
    wikiApi.info.mockResolvedValue([{ missing: '' }]);
    loggerLogWarningSpy = jest.spyOn(logger, 'logWarning').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.setSystemTime(jest.getRealSystemTime());
    jest.restoreAllMocks();
    loggerLogWarningSpy.mockRestore();
  });

  describe('getPagesToArchive', () => {
    it('should parse pages to archive from wiki table', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט !! מצב ארכוב עם יעד !! הוספת מצב חדש !! עדכון מצב בדיון
|-
| [[ויקיפדיה:מזנון]] || טופל,הועבר || 14 || רבעון || [[ויקיפדיה:מזנון]] || || כן || לא
|-
| [[ויקיפדיה:בקשות]] || נפתר || 7 || תבנית ארכיון || [[ויקיפדיה:בקשות/ניווט]] || ארכוב כפול || לא || כן
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
        targetedArchiveRegularArchiveMode: 'תבנית הועבר',
        addNewState: true,
        updateInDiscussionState: false,
      });
      expect(pages[1]).toStrictEqual({
        page: 'ויקיפדיה:בקשות',
        statuses: ['נפתר'],
        daysAfterLastActivity: 7,
        archiveType: 'תבנית ארכיון',
        archiveNavigatePage: 'ויקיפדיה:בקשות/ניווט',
        targetedArchiveRegularArchiveMode: 'ארכוב כפול',
        addNewState: false,
        updateInDiscussionState: true,
      });
    });

    it('should default new state flags to false when columns are missing', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט !! מצב ארכוב עם יעד
|-
| [[ויקיפדיה:מזנון]] || טופל || 14 || רבעון || [[ויקיפדיה:מזנון]] ||
|}`;

      wikiApi.articleContent.mockResolvedValue({ content: tableContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const pages = await model.getPagesToArchive();

      expect(pages[0].addNewState).toBe(false);
      expect(pages[0].updateInDiscussionState).toBe(false);
    });

    it('should throw error for invalid page link', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט !! מצב ארכוב עם יעד
|-
| InvalidPageWithoutBrackets || טופל || 14 || רבעון || [[ויקיפדיה:מזנון]] ||
|}`;

      wikiApi.articleContent.mockResolvedValue({ content: tableContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await expect(model.getPagesToArchive()).rejects.toThrow('Invalid page: InvalidPageWithoutBrackets');
    });

    it('should handle null archiveNavigatePage when link is invalid', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט !! מצב ארכוב עם יעד
|-
| [[ויקיפדיה:מזנון]] || טופל || 14 || רבעון || InvalidNavigatePageWithoutBrackets ||
|}`;

      wikiApi.articleContent.mockResolvedValue({ content: tableContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const pages = await model.getPagesToArchive();

      expect(pages).toHaveLength(1);
      expect(pages[0].archiveNavigatePage).toBeNull();
    });

    it('should default targeted archive regular archive mode when the config column is missing', async () => {
      const tableContent = `{| class="wikitable"
|-
! דף !! מצבים !! ימים !! סוג ארכיון !! דף ניווט !! מצב ארכוב עם יעד
|-
| [[ויקיפדיה:מזנון]] || טופל || 14 || רבעון || [[ויקיפדיה:מזנון]] || 
|}`;

      wikiApi.articleContent.mockResolvedValue({ content: tableContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const pages = await model.getPagesToArchive();

      expect(pages[0].targetedArchiveRegularArchiveMode).toBe('תבנית הועבר');
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

    it('should archive undated paragraph after it has been tracked long enough', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
No signature here
`;
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || 2025-01-01
|}`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 2 });
      wikiApi.info.mockResolvedValue([{}]);
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('Discussion 1');
    });

    it('should use current date for undated paragraph during quarterly archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
No signature here
`;
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || 2025-01-01
|}`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 2 });
      wikiApi.info.mockResolvedValue([{}]);
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage');

      expect(wikiApi.create).toHaveBeenCalledTimes(1);

      const createCall = (jest.mocked(wikiApi.create)).mock.calls[0];

      expect(createCall[0]).toContain('ארכיון');
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

  describe('state updates', () => {
    it('should add new state to a paragraph without מצב before archiving', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
No status template yet
10:00, 1 בפברואר 2025 (IDT)

==Discussion 2==
{{מצב|הועבר}}
Archive me
10:00, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage', 'תבנית הועבר', true, false);

      const sourceEdits = (jest.mocked(wikiApi.edit)).mock.calls.filter((call) => call[0] === 'TestPage');

      expect(sourceEdits[0][2]).toContain('{{מצב|חדש}}\nNo status template yet');
    });

    it('should update חדש to בדיון when at least two distinct users commented', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|חדש}}
[[משתמש:Alice]]
תגובה של אליס
[[user:Bob|Bob]]
תגובה של בוב

==Discussion 2==
{{מצב|הועבר}}
Archive me
10:00, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage', 'תבנית הועבר', false, true);

      const sourceEdits = (jest.mocked(wikiApi.edit)).mock.calls.filter((call) => call[0] === 'TestPage');

      expect(sourceEdits[0][2]).toContain('{{מצב|בדיון}}');
    });

    it('should keep חדש unchanged when only one user commented', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|חדש}}
[[משתמש:Alice]]
תגובה של אליס

==Discussion 2==
{{מצב|הועבר}}
Archive me
10:00, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Page not found'));
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });

      await model.archive('TestPage', archivableParagraphs, 'רבעון', 'TestPage', 'תבנית הועבר', false, true);

      const sourceEdits = (jest.mocked(wikiApi.edit)).mock.calls.filter((call) => call[0] === 'TestPage');

      expect(sourceEdits).toHaveLength(1);
      expect(sourceEdits[0][2]).not.toContain('{{מצב|בדיון}}');
    });
  });

  describe('archive', () => {
    it('should reject template archive without a navigation page', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Archive me
10:00, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      await expect(
        model.archive('TestPage', archivableParagraphs, 'תבנית ארכיון', null),
      ).rejects.toThrow('archiveNavigatePage is required for template archive with target');
    });

    it('should reject targeted template archive without a navigation page', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|הועבר}}
Archive me
10:00, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 14);

      await expect(
        model.archive('TestPage', archivableParagraphs, 'תבנית ארכיון עם יעד', null),
      ).rejects.toThrow('archiveNavigatePage is required for template archive with target');
    });

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
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Q1 Discussion", הועבר.',
        expect.stringContaining('First quarter discussion'),
      ]);
      expect(createCalls[1]).toStrictEqual([
        'TestPage/ארכיון אפריל-יוני 2025',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Q2 Discussion", טופל.',
        expect.stringContaining('Second quarter discussion'),
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
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion to Archive", הועבר.',
        expect.stringContaining('Old Discussion'),
        2,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion to Archive", הועבר.',
        expect.stringContaining('Discussion to Archive'),
        2,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion to Archive", הועבר.',
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
      expect(createCalls[0][1]).toBe('[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Q1 2025", הועבר.');
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
      expect(wikiApi.create).toHaveBeenCalledWith(
        expect.stringContaining('ארכיון'),
        expect.any(String),
        expect.stringContaining('Valid Discussion'),
      );
      expect(wikiApi.create).not.toHaveBeenCalledWith(
        expect.stringContaining('ארכיון'),
        expect.any(String),
        expect.stringContaining('Invalid Date Discussion'),
      );
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
      expect(wikiApi.create).toHaveBeenCalledWith(
        expect.stringContaining('ארכיון'),
        expect.any(String),
        expect.stringContaining('Valid Discussion'),
      );
      expect(wikiApi.create).not.toHaveBeenCalledWith(
        expect.stringContaining('ארכיון'),
        expect.any(String),
        expect.stringContaining('No Date Discussion'),
      );
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
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 1", הועבר.',
        expect.stringContaining('Discussion 1'),
      );

      // Should edit archive page twice for paragraphs 2 and 3
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 2", טופל.',
        expect.stringContaining('Discussion 2'),
        2,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 3", הועבר.',
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
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 1", הועבר.',
        expect.stringContaining('Discussion 1'),
        3,
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 1", הועבר.',
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
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 1", טופל.',
        expect.stringContaining('==Discussion 1==\n{{מצב|טופל}}\nDiscussion content'),
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 1", טופל.',
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

      expect(wikiApi.info).toHaveBeenCalledWith(['TestPage/ארכיון 2']);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 2',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion 1", הועבר.',
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
{{מצב|טופל|בוט}}
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
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion with Handler", טופל. מטפל: [[user:בוט|בוט]].',
        expect.stringContaining('Discussion with Handler'),
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: ארכוב הדיון "Discussion with Handler", טופל. מטפל: [[user:בוט|בוט]].',
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

      await model.archive('TestPage', [paragraphWithoutTemplate], 'רבעון', 'TestPage');

      expect(loggerLogWarningSpy).toHaveBeenCalledWith('No status template found for paragraph: TestPage: Discussion Without Template');
      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(loggerLogWarningSpy).toHaveBeenCalledTimes(1);
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

      await model.archive('TestPage', [paragraphWithoutTemplate], 'תבנית ארכיון', 'TestPage/Navigate');

      expect(loggerLogWarningSpy).toHaveBeenCalledWith('No status template found for paragraph: TestPage: Discussion Without Template');
      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(loggerLogWarningSpy).toHaveBeenCalledTimes(1);
    });

    it('should archive to target specified in ארכוב field for תבנית ארכיון עם יעד', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithTarget = `
==Discussion 1==
{{מצב|טופל|ארכוב=TargetPage}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const paragraphWithDefault = `
==Discussion 2==
{{מצב|טופל|ארכוב=ארכיון}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const paragraphWithoutArchive = `
==Discussion 3==
{{מצב|טופל}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      const sourceContent = `${paragraphWithTarget}\n${paragraphWithDefault}\n${paragraphWithoutArchive}`;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: sourceContent, revid: 1 },
        'TestPage/ארכיון 1': { content: '{{ארכיון הדט}}', revid: 3 },
      }, title, { content: '', revid: 0 }));

      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraphWithTarget, paragraphWithDefault, paragraphWithoutArchive], 'תבנית ארכיון עם יעד', 'TestPage/Navigate');

      // Verify Discussion 1 was archived to TargetPage with wrapping
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TargetPage',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining('==Discussion 1==\n{{הועבר|מ=TestPage}}\n{{מצב|טופל}}\nDiscussion content'),
      );

      // Verify Discussion 2 was archived to TestPage/ארכיון 1 WITHOUT wrapping (via EDIT since page exists)
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.stringContaining('Discussion 2'),
        expect.stringMatching(/\{\{ארכיון הדט\}\}[\s\S]*==Discussion 2==[\s\S]*Discussion content/),
        3,
      );

      // Verify Discussion 1 source edit: full paragraph removed (paragraph itself is gone)
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        expect.stringContaining('Discussion 1'),
        expect.not.stringContaining('Discussion 1'),
        1,
      );

      // Verify Discussion 2 source edit: paragraph fully removed (not targeted)
      expect(wikiApi.edit).toHaveBeenCalledWith('TestPage', expect.stringContaining('Discussion 2'), expect.not.stringContaining('Discussion 2'), 1);

      // Verify Discussion 3 was NOT archived
      expect(wikiApi.create).toHaveBeenCalledTimes(1);

      // Verify stub was added to TestPage/ארכיון 1 (edited with הועבר marker and ~~~~)
      // eslint-disable-next-line jest/max-expects
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.any(String),
        expect.stringContaining('{{הועבר|ל=TargetPage}}'),
        expect.any(Number),
      );
    });

    it('should throw error when archive title lookup fails in תבנית ארכיון עם יעד', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithDefault = `
==Discussion==
{{מצב|טופל|ארכוב=ארכיון}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const navigatePageContent = 'No archive box here';

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: paragraphWithDefault, revid: 1 },
      }, title, { content: '', revid: 0 }));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await expect(
        model.archive('TestPage', [paragraphWithDefault], 'תבנית ארכיון עם יעד', 'TestPage/Navigate'),
      ).rejects.toThrow('Failed to get archive title: תיבת ארכיון לא נמצאה');
    });

    it('should use cached default archive title in תבנית ארכיון עם יעד', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraph1 = `
==Discussion 1==
{{מצב|טופל|ארכוב=ארכיון}}
Discussion 1 content
10:00, 1 בפברואר 2025 (IDT)
`;
      const paragraph2 = `
==Discussion 2==
{{מצב|טופל|ארכוב=ארכיון}}
Discussion 2 content
10:00, 1 בפברואר 2025 (IDT)
`;
      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: `${paragraph1}\n${paragraph2}`, revid: 1 },
      }, title, { content: '', revid: 0 }));

      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraph1, paragraph2], 'תבנית ארכיון עם יעד', 'TestPage/Navigate');

      // Verify navigate page was only read once despite two paragraphs needing default archive
      const articleContentCalls = (jest.mocked(wikiApi.articleContent)).mock.calls;
      const navigateReads = articleContentCalls.filter((call) => call[0] === 'TestPage/Navigate');

      expect(navigateReads).toHaveLength(1);
    });

    it('should cover both branches of isTargeted in archiveSingleParagraphTemplate', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithoutTarget = `
==Discussion 1==
{{מצב|טופל}}
Content
10:00, 1 בפברואר 2025 (IDT)
`;
      const paragraphWithTarget = `
==Discussion 2==
{{מצב|טופל|ארכוב=TargetPage}}
Content
10:00, 1 בפברואר 2025 (IDT)
`;
      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: `${paragraphWithoutTarget}\n${paragraphWithTarget}`, revid: 1 },
        'TestPage/ארכיון 1': { content: '{{ארכיון הדט}}', revid: 3 },
      }, title, { content: '', revid: 0 }));

      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      // 1. isTargeted = false (via תבנית ארכיון algorithm for paragraph without ארכוב)
      await model.archive('TestPage', [paragraphWithoutTarget], 'תבנית ארכיון', 'TestPage/Navigate');

      expect(wikiApi.edit).toHaveBeenCalledWith('TestPage/ארכיון 1', expect.any(String), expect.not.stringContaining('{{הועבר'), expect.any(Number));
      // Source page edit should fully remove the paragraph (no stub for non-targeted)
      expect(wikiApi.edit).toHaveBeenCalledWith('TestPage', expect.any(String), expect.not.stringContaining('~~~~'), expect.any(Number));

      wikiApi.create.mockClear();
      wikiApi.edit.mockClear();

      // 2. isTargeted = true (via תבנית ארכיון עם יעד algorithm for paragraph with ארכוב)
      await model.archive('TestPage', [paragraphWithTarget], 'תבנית ארכיון עם יעד', 'TestPage/Navigate');

      expect(wikiApi.create).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('{{הועבר'));
      // Archive page edit should include stub with הועבר|ל and ~~~~
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.any(String),
        expect.stringContaining('{{הועבר|ל=TargetPage}}'),
        expect.any(Number),
      );
    });

    it('should support optional ארכוב field in רבעון archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithTarget = `
==Discussion 1==
{{מצב|טופל|ארכוב=TargetPage}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const paragraphWithoutTarget = `
==Discussion 2==
{{מצב|טופל}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const sourceContent = `${paragraphWithTarget}\n${paragraphWithoutTarget}`;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        TestPage: { content: sourceContent, revid: 1 },
        'TestPage/ארכיון ינואר-מרץ 2025': { content: '{{ארכיון הדט}}', revid: 2 },
      }, title, { content: '', revid: 0 }));

      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraphWithTarget, paragraphWithoutTarget], 'רבעון', 'TestPage');

      // Verify Discussion 1 was archived to TargetPage with wrapping
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TargetPage',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining('==Discussion 1==\n{{הועבר|מ=TestPage}}\n{{מצב|טופל}}\nDiscussion content'),
      );

      // Verify Discussion 2 was archived to quarterly archive WITHOUT wrapping (via EDIT since page exists)
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        expect.stringContaining('Discussion 2'),
        expect.stringMatching(/\{\{ארכיון הדט\}\}[\s\S]*==Discussion 2==/),
        expect.any(Number),
      );

      // Verify Discussion 1 source edit: paragraph removed and stub added to quarterly archive
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון ינואר-מרץ 2025',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining('{{הועבר|ל=TargetPage}}'),
        expect.any(Number),
      );
    });

    it('should support optional ארכוב field in תבנית ארכיון archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithTarget = `
==Discussion 1==
{{מצב|טופל|ארכוב=TargetPage}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const paragraphWithoutTarget = `
==Discussion 2==
{{מצב|טופל}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      const sourceContent = `${paragraphWithTarget}\n${paragraphWithoutTarget}`;
      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: sourceContent, revid: 1 },
        'TestPage/ארכיון 1': { content: '{{ארכיון הדט}}', revid: 3 },
      }, title, { content: '', revid: 0 }));

      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraphWithTarget, paragraphWithoutTarget], 'תבנית ארכיון', 'TestPage/Navigate');

      // Verify Discussion 1 was archived to TargetPage with wrapping
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TargetPage',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining('==Discussion 1==\n{{הועבר|מ=TestPage}}\n{{מצב|טופל}}\nDiscussion content'),
      );

      // Verify Discussion 2 was archived to default archive WITHOUT wrapping
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.stringContaining('Discussion 2'),
        expect.stringContaining('Discussion 2'),
        expect.any(Number),
      );
      // Verify Discussion 1 source edit: stub added with status template + הועבר|ל=TargetPage + ~~~~
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.stringContaining('Discussion 1'),
        expect.stringMatching(/\{\{הועבר\|ל=TargetPage\}\}[\s\S]*~~~~$/),
        expect.any(Number),
      );
    });

    it('should prepend the draft transfer archive header on the special page', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
{{מצב|טופל}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'ויקיפדיה:העברת דפי טיוטה': { content: pageContent, revid: 1 },
      }, title, { content: '', revid: 0 }));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      const archivableParagraphs = await model.getArchivableParagraphs('ויקיפדיה:העברת דפי טיוטה', ['טופל'], 14);

      await model.archive('ויקיפדיה:העברת דפי טיוטה', archivableParagraphs, 'רבעון', '');

      expect(wikiApi.create).toHaveBeenCalledWith(
        'ויקיפדיה:העברת דפי טיוטה/ארכיון ינואר-מרץ 2025',
        expect.any(String),
        expect.stringContaining('{{ארכיון הדט}}\n\n==Discussion 1=='),
      );
    });
  });

  describe('delete algorithm', () => {
    it('should delete paragraphs from page', async () => {
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
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      wikiApi.edit.mockResolvedValue({
        edit: {
          contentmodel: '',
          pageid: 123,
          result: '',
          title: '',
          newrevid: 123,
        },
      });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);
      const archiveableParagraphs = await model.getArchivableParagraphs('TestPage', ['הועבר'], 7);
      await model.archive('TestPage', archiveableParagraphs, 'מחיקה', '');

      expect(wikiApi.edit).toHaveBeenCalledTimes(1);
      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: מחיקת הדיון "Discussion 1", הועבר.',
        `==Discussion 2==
{{מצב|טופל}}
Another discussion
09:00, 15 בינואר 2025 (IDT)`,
        1,
      );
    });

    it('should not delete paragraphs from page if no paragraphs are archivable', async () => {
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
`;
      wikiApi.edit.mockResolvedValue({
        edit: {
          contentmodel: '',
          pageid: 123,
          result: '',
          title: '',
          newrevid: 123,
        },
      });
      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = ClosedDiscussionsArchiveBotModel(wikiApi);
      await model.archive('TestPage', ['==headline==\n{{מצב|טופל}}text not from page'], 'מחיקה', '');

      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should keep deleting with the same base revid when edit response has no newrevid', async () => {
      const paragraph1 = `==Discussion 1==
{{מצב|הועבר}}
Some discussion content
12:42, 1 בינואר 2025 (IDT)`;
      const paragraph2 = `==Discussion 2==
{{מצב|טופל}}
Another discussion
09:00, 15 בינואר 2025 (IDT)`;
      const pageContent = `${paragraph1}\n\n${paragraph2}`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      wikiApi.edit
        .mockResolvedValueOnce({
          edit: {
            contentmodel: '',
            pageid: 123,
            result: '',
            title: '',
            newrevid: undefined,
          },
        } as any)
        .mockResolvedValueOnce({
          edit: {
            contentmodel: '',
            pageid: 123,
            result: '',
            title: '',
            newrevid: 456,
          },
        });

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraph1, paragraph2], 'מחיקה', '');

      expect(wikiApi.edit).toHaveBeenNthCalledWith(
        1,
        'TestPage',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: מחיקת הדיון "Discussion 1", הועבר.',
        expect.any(String),
        1,
      );
      expect(wikiApi.edit).toHaveBeenNthCalledWith(
        2,
        'TestPage',
        '[[ויקיפדיה:בוט/ארכוב דיונים|בוט ארכוב דיונים]]: מחיקת הדיון "Discussion 2", טופל.',
        '',
        1,
      );
    });

    it('should not archive when paragraph has no status template', async () => {
      const pageContent = `
==Discussion 1==
No status template here
12:42, 1 בינואר 2025 (IDT)

==Discussion 2==
Still here
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      wikiApi.edit.mockResolvedValue({
        edit: {
          contentmodel: '',
          pageid: 123,
          result: '',
          title: '',
          newrevid: 123,
        },
      });

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', ['==Discussion 1==\nNo status template here\n12:42, 1 בינואר 2025 (IDT)'], 'מחיקה', '');

      expect(wikiApi.edit).not.toHaveBeenCalled();
    });

    it('should archive to target and add transfer stub to regular archive in מחיקה mode by default', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithTarget = `
==Discussion 1==
{{מצב|טופל|ארכוב=TargetPage}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;
      const sourceContent = paragraphWithTarget;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: sourceContent, revid: 1 },
        'TestPage/ארכיון 1': { content: '{{ארכיון הדט}}\n\nExisting content', revid: 3 },
      }, title, { content: '', revid: 0 }));
      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));
      wikiApi.edit.mockResolvedValue({
        edit: {
          contentmodel: '',
          pageid: 123,
          result: '',
          title: '',
          newrevid: 456,
        },
      });

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraphWithTarget], 'מחיקה', 'TestPage/Navigate');

      expect(wikiApi.create).toHaveBeenCalledWith(
        'TargetPage',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining('==Discussion 1==\n{{הועבר|מ=TestPage}}\n{{מצב|טופל}}\nDiscussion content'),
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining('{{הועבר|ל=TargetPage}}'),
        3,
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        expect.stringContaining('Discussion 1'),
        expect.not.stringContaining('Discussion 1'),
        1,
      );
    });

    it('should double archive the whole paragraph in מחיקה mode when configured', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithTarget = `
==Discussion 1==
{{מצב|טופל|ארכוב=TargetPage}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;
      const sourceContent = paragraphWithTarget;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: sourceContent, revid: 1 },
        'TestPage/ארכיון 1': { content: '{{ארכיון הדט}}\n\nExisting content', revid: 3 },
      }, title, { content: '', revid: 0 }));
      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));
      wikiApi.edit.mockResolvedValue({
        edit: {
          contentmodel: '',
          pageid: 123,
          result: '',
          title: '',
          newrevid: 456,
        },
      });

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive(
        'TestPage',
        [paragraphWithTarget],
        'מחיקה',
        'TestPage/Navigate',
        'ארכוב כפול',
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining(paragraphWithTarget.trim()),
        3,
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        expect.stringContaining('Discussion 1'),
        expect.not.stringContaining('Discussion 1'),
        1,
      );

      expect(wikiApi.edit).not.toHaveBeenCalledWith(
        'TestPage/ארכיון 1',
        expect.any(String),
        expect.stringContaining('{{הועבר|ל=TargetPage}}'),
        expect.any(Number),
      );
    });

    it('should delete non-targeted paragraphs and archive targeted ones in מחיקה mode', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithTarget = `
==Discussion 1==
{{מצב|טופל|ארכוב=TargetPage}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const paragraphWithoutTarget = `
==Discussion 2==
{{מצב|הועבר}}
Discussion content
11:00, 1 בפברואר 2025 (IDT)
`;
      const navigatePageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;
      const sourceContent = `${paragraphWithTarget}\n${paragraphWithoutTarget}`;

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: sourceContent, revid: 1 },
        'TestPage/ארכיון 1': { content: '{{ארכיון הדט}}\n\nExisting content', revid: 3 },
      }, title, { content: '', revid: 0 }));
      wikiApi.info.mockImplementation(async (titles) => titles.map((title) => getMockResponse({
        'TestPage/ארכיון 1': {},
      }, title, { missing: '' })));
      wikiApi.edit.mockResolvedValue({
        edit: {
          contentmodel: '',
          pageid: 123,
          result: '',
          title: '',
          newrevid: 456,
        },
      });

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraphWithTarget, paragraphWithoutTarget], 'מחיקה', 'TestPage/Navigate');

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'TestPage',
        expect.stringContaining('Discussion 2'),
        expect.not.stringContaining('Discussion 2'),
        1,
      );
      expect(wikiApi.create).toHaveBeenCalledWith(
        'TargetPage',
        expect.stringContaining('Discussion 1'),
        expect.stringContaining('==Discussion 1==\n{{הועבר|מ=TestPage}}\n{{מצב|טופל}}\nDiscussion content'),
      );
    });

    it('should throw when target archive lookup fails in מחיקה mode', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithTarget = `
==Discussion 1==
{{מצב|טופל|ארכוב=TargetPage}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;
      const navigatePageContent = 'No archive box here';

      wikiApi.articleContent.mockImplementation(async (title) => getMockResponse({
        'TestPage/Navigate': { content: navigatePageContent, revid: 2 },
        TestPage: { content: paragraphWithTarget, revid: 1 },
      }, title, { content: '', revid: 0 }));

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await expect(
        model.archive('TestPage', [paragraphWithTarget], 'מחיקה', 'TestPage/Navigate'),
      ).rejects.toThrow('Failed to get archive title: תיבת ארכיון לא נמצאה');
    });

    it('should skip targeted archive when ארכוב is default archive and no navigate page is available', async () => {
      fakerTimers.setSystemTime(new Date('2025-07-01T00:00:00Z'));

      const paragraphWithDefaultArchive = `
==Discussion 1==
{{מצב|טופל|ארכוב=ארכיון}}
Discussion content
10:00, 1 בפברואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: paragraphWithDefaultArchive, revid: 1 });

      model = ClosedDiscussionsArchiveBotModel(wikiApi);

      await model.archive('TestPage', [paragraphWithDefaultArchive], 'מחיקה', '');

      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
    });
  });
});
