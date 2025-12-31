import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import UserTalkArchiveBotModel, { IUserTalkArchiveBotModel } from '../maintenance/userTalkArchiveBot/UserTalkArchiveBotModel';
import { IWikiApi } from '../wiki/WikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('userTalkArchiveBotModel', () => {
  let model: IUserTalkArchiveBotModel;
  let wikiApi: Mocked<IWikiApi>;
  const fakerTimers = jest.useFakeTimers();

  beforeEach(() => {
    wikiApi = WikiApiMock();
    wikiApi.info.mockResolvedValue([{}]);
    wikiApi.articleContent.mockResolvedValue({ content: '', revid: 1 });
  });

  afterEach(() => {
    jest.setSystemTime(jest.getRealSystemTime());
    jest.restoreAllMocks();
  });

  describe('getConfigFromPageContent', () => {
    it('should parse config with archive box from template', () => {
      const pageContent = `{{בוט ארכוב אוטומטי|ימים מתגובה אחרונה=14|מיקום תבנית תיבת ארכיון=[[שיחת משתמש:דוגמה/ארכיונים]]|גודל דף ארכיון=50000|ראש דף ארכיון={{ארכיון}}}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config).toStrictEqual({
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      });
    });

    it('should parse config with direct archive page', () => {
      const pageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]|ראש דף ארכיון={{ארכיון הדט}}}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config).toStrictEqual({
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 30,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון הדט}}',
        createNewArchive: true,
      });
    });

    it('should use default values when optional fields are empty', () => {
      const pageContent = `{{בוט ארכוב אוטומטי|מיקום תבנית תיבת ארכיון=שיחת משתמש:דוגמה/ארכיונים}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config?.inactivityDays).toBe(30);
      expect(config?.maxArchiveSize).toBe(100000);
      expect(config?.archiveHeader).toBe('{{ארכיון}}');
    });

    it('should return null when neither archive box nor direct archive is provided', () => {
      const pageContent = `{{בוט ארכוב אוטומטי|ימים מתגובה אחרונה=14}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config).toBeNull();
    });

    it('should parse createNewArchive as false when set to לא', () => {
      const pageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]|יצירת דף ארכיון חדש=לא}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config?.createNewArchive).toBe(false);
    });

    it('should return null when template not found', () => {
      const pageContent = `==דיון==
תוכן ללא תבנית`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config).toBeNull();
    });

    it('should handle direct archive page without wiki link syntax', () => {
      const pageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=שיחת משתמש:דוגמה/ארכיון 1}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config?.directArchivePage).toBe('שיחת משתמש:דוגמה/ארכיון 1');
    });

    it('should handle template with unnamed parameters', () => {
      const pageContent = `{{בוט ארכוב אוטומטי|[[שיחת משתמש:דוגמה/ארכיון 1]]}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config).toBeNull();
    });

    it('should handle template without any parameters', () => {
      const pageContent = `{{בוט ארכוב אוטומטי}}
==דיון==
תוכן`;

      model = UserTalkArchiveBotModel(wikiApi);

      const config = model.getConfigFromPageContent('שיחת משתמש:דוגמה', pageContent);

      expect(config).toBeNull();
    });
  });

  describe('getArchivableParagraphs', () => {
    it('should return paragraphs with old signatures', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)

==Discussion 2==
Another old discussion
09:00, 5 בינואר 2025 (IDT)

==Discussion 3==
Recent discussion
23:59, 25 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = UserTalkArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('שיחת משתמש:דוגמה', 14);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('Discussion 1');
      expect(result[1]).toContain('Discussion 2');
    });

    it('should return empty array when no archivable paragraphs', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
Recent discussion
23:59, 20 בינואר 2025 (IDT)

==Discussion 2==
Another recent discussion
10:00, 25 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = UserTalkArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('שיחת משתמש:דוגמה', 14);

      expect(result).toHaveLength(0);
    });

    it('should not archive paragraphs without signatures', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
No signature here
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = UserTalkArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('שיחת משתמש:דוגמה', 14);

      expect(result).toHaveLength(0);
    });

    it('should use custom inactivity days', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
Discussion content
12:42, 25 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = UserTalkArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('שיחת משתמש:דוגמה', 7);

      expect(result).toHaveLength(1);
    });

    it('should handle multiple signatures and use the last one', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
First signature: 10:00, 1 בינואר 2025 (IDT)
Second signature: 12:00, 2 בינואר 2025 (IDT)
Last signature: 15:00, 20 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = UserTalkArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('שיחת משתמש:דוגמה', 14);

      expect(result).toHaveLength(0);
    });

    it('should skip paragraphs with no archive template', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)

==Discussion 2==
{{לא לארכוב}}
Old discussion that should not be archived
12:42, 1 בינואר 2025 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = UserTalkArchiveBotModel(wikiApi);

      const result = await model.getArchivableParagraphs('שיחת משתמש:דוגמה', 14);

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('Discussion 1');
      expect(result[0]).not.toContain('Discussion 2');
    });
  });

  describe('archive with archive box', () => {
    it('should archive to last archive page from archive box', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
* [[/ארכיון 2]]
}}`;

      const existingArchiveContent = `{{ארכיון}}

==Old Discussion==
Old content`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.edit).toHaveBeenNthCalledWith(
        1,
        'שיחת משתמש:דוגמה/ארכיון 2',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: ארכוב אוטומטי של דיונים ישנים',
        expect.stringContaining('Discussion 1'),
        3,
      );
    });

    it('should create new archive page when size limit is reached', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001); // Exceeds limit

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון}}', revid: 4 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.create).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 2',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: יצירת דף ארכיון חדש',
        '{{ארכיון}}',
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיונים',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הוספת דף ארכיון חדש',
        expect.stringContaining('[[שיחת משתמש:דוגמה/ארכיון 2|ארכיון 2]]'),
        2,
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 2',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: ארכוב אוטומטי של דיונים ישנים',
        expect.stringContaining('Discussion 1'),
        4,
      );
    });

    it('should notify user when archive page name cannot be incremented', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 }); // archive box page
      wikiApi.info.mockResolvedValueOnce([{}]); // check /ארכיון exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 }); // archive content (too large)
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 }); // source page for notification

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב',
        expect.stringContaining('דף הארכיון'),
        1,
      );
    });

    it('should notify user when archive box is full and createNewArchive is false', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: false,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);
      consoleWarnSpy.mockRestore();

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב',
        expect.stringContaining('הגיע לגודל המקסימלי'),
        1,
      );

      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should handle archive with spaces in number format', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 5]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון}}', revid: 4 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.create).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 6',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: יצירת דף ארכיון חדש',
        '{{ארכיון}}',
      );

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 6',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: ארכוב אוטומטי של דיונים ישנים',
        expect.stringContaining('Discussion 1'),
        4,
      );
    });

    it('should handle multiple paragraphs when creating new archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion 1
12:42, 1 בינואר 2025 (IDT)

==Discussion 2==
Old discussion 2
13:42, 2 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון}}', revid: 4 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [
        `==Discussion 1==
Old discussion 1
12:42, 1 בינואר 2025 (IDT)
`,
        `==Discussion 2==
Old discussion 2
13:42, 2 בינואר 2025 (IDT)
`,
      ]);

      expect(wikiApi.create).toHaveBeenCalledTimes(1);

      const editCalls = (jest.mocked(wikiApi.edit)).mock.calls;
      const archiveBoxUpdate = editCalls.find((call) => call[0] === 'שיחת משתמש:דוגמה/ארכיונים');

      expect(archiveBoxUpdate).toBeDefined();

      const archiveEdits = editCalls.filter((call) => call[0] === 'שיחת משתמש:דוגמה/ארכיון 2');

      expect(archiveEdits.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect link style from existing archive box with multiple links', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
# [[/ארכיון 1]]
# [[/ארכיון 2]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון}}', revid: 4 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      const editCalls = (jest.mocked(wikiApi.edit)).mock.calls;
      const archiveBoxUpdate = editCalls.find((call) => call[0] === 'שיחת משתמש:דוגמה/ארכיונים');

      expect(archiveBoxUpdate).toBeDefined();
      expect(archiveBoxUpdate?.[2]).toContain('\n# [[שיחת משתמש:דוגמה/ארכיון 3|ארכיון 3]]');
    });

    it('should use full page name as display when no slash exists', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[ארכיון1]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון}}', revid: 4 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      const editCalls = (jest.mocked(wikiApi.edit)).mock.calls;
      const archiveBoxUpdate = editCalls.find((call) => call[0] === 'שיחת משתמש:דוגמה/ארכיונים');

      expect(archiveBoxUpdate).toBeDefined();
      expect(archiveBoxUpdate?.[2]).toContain('[[ארכיון2|ארכיון2]]');
    });

    it('should fallback to # prefix when archive box has no prefix', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = '{{תיבת ארכיון|[[ארכיון1]]}}';

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון}}', revid: 4 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      const editCalls = (jest.mocked(wikiApi.edit)).mock.calls;
      const archiveBoxUpdate = editCalls.find((call) => call[0] === 'שיחת משתמש:דוגמה/ארכיונים');

      expect(archiveBoxUpdate).toBeDefined();
      expect(archiveBoxUpdate?.[2]).toContain('\n#[[ארכיון2|ארכיון2]]');
    });

    it('should use existing new archive when it already exists', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);
      const newArchiveContent = `{{ארכיון}}

==Some old content==`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: newArchiveContent, revid: 4 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 2',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: ארכוב אוטומטי של דיונים ישנים',
        expect.stringContaining('Discussion 1'),
        4,
      );
    });

    it('should handle error when archive template not found', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const archiveBoxContent = 'No archive box template here';

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב',
        expect.stringContaining('תיבת ארכיון לא נמצאה'),
        1,
      );
    });

    it('should handle error when archive box content is empty', async () => {
      const archiveBoxContent = '{{תיבת ארכיון}}';

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: 'talk page content', revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`==Discussion 1==
Old discussion
`]);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב',
        expect.stringContaining('התוכן של תיבת הארכיון לא נמצא'),
        1,
      );
    });

    it('should handle error when no active archive found', async () => {
      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
}}`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: 'talk page content', revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`==Discussion 1==
Old discussion
`]);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב',
        expect.stringContaining('לא נמצא דף ארכיון פעיל'),
        1,
      );
    });
  });

  describe('archive with direct page', () => {
    it('should archive to direct page', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const existingArchiveContent = `{{ארכיון}}

==Old Discussion==
Old content`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 1',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: ארכוב אוטומטי של דיונים ישנים',
        expect.stringContaining('Discussion 1'),
        2,
      );
    });

    it('should auto-increment and create new archive when direct archive exceeds size limit', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]}}
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      // Flow:
      // 1. getContentOrNull(archive 1): pageExists + articleContent
      wikiApi.info.mockResolvedValueOnce([{}]); // archive 1 exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 }); // archive 1 content (too large)

      // 2. pageExists(archive 2): check if new archive exists
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]); // archive 2 doesn't exist

      // 3. create(archive 2) - no mock needed

      // 4. updateDirectArchiveTemplateParameter: getContent(talk page)
      wikiApi.info.mockResolvedValueOnce([{}]); // talk page exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 }); // talk page content

      // 5. archiveParagraphs:
      //    - getContentOrNull(archive 2): pageExists + articleContent
      wikiApi.info.mockResolvedValueOnce([{}]); // archive 2 now exists (just created)
      wikiApi.articleContent.mockResolvedValueOnce({ content: '{{ארכיון}}', revid: 10 }); // new archive content
      //    - getContent(talk page)
      wikiApi.info.mockResolvedValueOnce([{}]); // talk page exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 3 }); // talk page for removal

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      // Should create new archive page
      expect(wikiApi.create).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 2',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: יצירת דף ארכיון חדש',
        '{{ארכיון}}',
      );

      // Should update template parameter in talk page
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: עדכון דף ארכיון חדש',
        expect.stringContaining('שיחת משתמש:דוגמה/ארכיון 2'),
        1,
      );
    });

    it('should notify user when direct archive is full and createNewArchive is false', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]}}
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: false,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);
      consoleWarnSpy.mockRestore();

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב',
        expect.stringContaining('הגיע לגודל המקסימלי'),
        1,
      );

      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should create new direct archive page if it does not exist', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      expect(wikiApi.create).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 1',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: ארכוב אוטומטי של דיונים ישנים',
        expect.stringContaining('{{ארכיון}}'),
      );
    });

    it('should notify user when direct archive name cannot be incremented', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון]]}}
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;
      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון', // No number at the end
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]); // archive exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 }); // too large
      wikiApi.info.mockResolvedValueOnce([{}]); // talk page exists for notification
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 }); // talk page content

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);
      consoleWarnSpy.mockRestore();

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה',
        '[[תבנית:בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: הודעה מבוט הארכוב',
        expect.stringContaining('לא ניתן ליצור דף חדש אוטומטית'),
        1,
      );
    });

    it('should throw when neither archive box nor direct page is provided', async () => {
      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      model = UserTalkArchiveBotModel(wikiApi);

      await expect(model.archive(config, ['==Discussion==\nContent\n']))
        .rejects.toThrow('Either archive box page or direct archive page must be provided');
    });

    it('should use existing new archive when direct archive exceeds size limit', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]}}
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;
      const existingArchiveContent = 'x'.repeat(50001);
      const newArchiveContent = '{{ארכיון}}';

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      // getContentOrNull(archive 1): archive exists and is too large
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 });

      // pageExists(archive 2): new archive ALREADY exists (created manually)
      wikiApi.info.mockResolvedValueOnce([{}]);

      // archiveParagraphs:
      // getContentOrNull(archive 2): exists
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: newArchiveContent, revid: 10 });

      // getContent(talkPage) for removal
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 3 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      // Should NOT create new archive page (it already exists)
      expect(wikiApi.create).not.toHaveBeenCalled();

      // Should edit the existing archive 2
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 2',
        expect.any(String),
        expect.stringContaining('Discussion 1'),
        10,
      );
    });

    it('should throw when template is missing during direct archive update', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageWithoutTemplate = `==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`;
      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      // getContentOrNull(archive 1): archive exists and is too large
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 2 });

      // pageExists(archive 2): new archive doesn't exist
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);

      // create(archive 2) - no mock needed

      // updateDirectArchiveTemplateParameter: getContent(talk page) - no template!
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageWithoutTemplate, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await expect(model.archive(config, [`
==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`])).rejects.toThrow('תבנית בוט ארכוב אוטומטי לא נמצאה');
    });
  });

  describe('archive error handling', () => {
    let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should throw error when both archiveBoxPage and directArchivePage are null', async () => {
      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      model = UserTalkArchiveBotModel(wikiApi);

      await expect(
        model.archive(config, [`==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]),
      ).rejects.toThrow('Either archive box page or direct archive page must be provided');
    });

    it('should throw error when page content is missing', async () => {
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);

      model = UserTalkArchiveBotModel(wikiApi);

      await expect(
        model.getArchivableParagraphs('שיחת משתמש:דוגמה', 14),
      ).rejects.toThrow('Missing content for שיחת משתמש:דוגמה');
    });

    it('should handle error when archive box update fails due to missing template', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const archiveBoxContent = '{{תיבת ארכיון|\n* [[/ארכיון 1]]\n}}';

      const existingArchiveContent = 'x'.repeat(50001);
      const archiveBoxNoTemplate = 'No template here';

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxNoTemplate, revid: 4 });

      model = UserTalkArchiveBotModel(wikiApi);

      await expect(
        model.archive(config, [`==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]),
      ).rejects.toThrow('תיבת ארכיון לא נמצאה');
    });

    it('should log error when notification fails', async () => {
      const archiveBoxContent = 'No archive box template';

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.articleContent.mockRejectedValueOnce(new Error('Failed to get talk page'));

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, ['==Discussion 1==\nOld discussion\n']);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to archive'),
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to notify user'),
        expect.any(Error),
      );
    });

    it('should skip notification if bot message already exists on page', async () => {
      const archiveBoxContent = 'No archive box template';

      const talkPageWithBotMessage = `
==Some discussion==
Content

== הודעה מבוט הארכוב ==
Previous message from bot
`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageWithBotMessage, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, ['==Discussion 1==\nOld discussion\n']);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping notification'),
      );

      expect(wikiApi.edit).not.toHaveBeenCalled();
    });
  });

  describe('getLastActiveArchiveLink edge cases', () => {
    it('should handle archive link without slash prefix', async () => {
      const archiveBoxContent = `{{תיבת ארכיון|
* [[ארכיון מלא]]
}}`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: 'old content', revid: 3 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: 'talk page', revid: 4 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, ['==Discussion==\nOld\n']);

      expect(wikiApi.info).toHaveBeenCalledWith(['ארכיון מלא']);
    });
  });

  describe('archive with size checks', () => {
    it('should handle null existing archive content when checking size with archive box', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
}}`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: '', revid: 0 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: 'existing archive', revid: 3 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: 'talk page', revid: 4 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, ['==Discussion==\nOld\n12:42, 1 בינואר 2025 (IDT)\n']);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 1',
        expect.any(String),
        expect.stringContaining('==Discussion=='),
        3,
      );
    });

    it('should handle null existing direct archive content when checking size', async () => {
      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון',
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: 'talk page', revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, ['==Discussion==\nOld\n']);

      expect(wikiApi.create).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון',
        expect.any(String),
        expect.stringContaining('{{ארכיון}}'),
      );
    });

    it('should handle empty paragraphs when creating new archive', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const archiveBoxContent = `{{תיבת ארכיון|
* [[/ארכיון 1]]
}}`;

      const existingArchiveContent = 'x'.repeat(50001);

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: 'שיחת משתמש:דוגמה/ארכיונים',
        directArchivePage: null,
        maxArchiveSize: 50000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.articleContent.mockResolvedValueOnce({ content: archiveBoxContent, revid: 2 });
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: existingArchiveContent, revid: 3 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: '', revid: 0 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, []);

      expect(wikiApi.create).not.toHaveBeenCalled();
    });
  });

  describe('archive general', () => {
    it('should not archive when no paragraphs provided', async () => {
      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, []);

      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
    });

    it('should clean up multiple newlines in source page', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const talkPageContent = `==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)

==Discussion 2==
Still active content

==Discussion 3==
More content`;

      const config = {
        talkPage: 'שיחת משתמש:דוגמה',
        inactivityDays: 14,
        archiveBoxPage: null,
        directArchivePage: 'שיחת משתמש:דוגמה/ארכיון 1',
        maxArchiveSize: 100000,
        archiveHeader: '{{ארכיון}}',
        createNewArchive: true,
      };

      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: talkPageContent, revid: 1 });

      model = UserTalkArchiveBotModel(wikiApi);

      await model.archive(config, [`==Discussion 1==
Old discussion
12:42, 1 בינואר 2025 (IDT)
`]);

      const editCalls = (jest.mocked(wikiApi.edit)).mock.calls;
      const sourceEditCall = editCalls.find((call) => call[0] === 'שיחת משתמש:דוגמה');

      expect(sourceEditCall).toBeDefined();
      expect(sourceEditCall?.[2]).not.toMatch(/\n\n\n/);
    });
  });

  describe('run', () => {
    let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should process pages from generator and archive old discussions', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]}}
==דיון ישן==
תוכן ישן
12:42, 1 בינואר 2025 (IDT)`;

      async function* mockGenerator() {
        yield [{
          pageid: 1,
          ns: 3,
          title: 'שיחת משתמש:דוגמה',
          extlinks: [],
          revisions: [{
            user: 'test',
            size: 100,
            slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': pageContent } },
          }],
        }];
      }

      wikiApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());

      // getArchivableParagraphs: getContent(talkPage)
      wikiApi.info.mockResolvedValueOnce([{}]); // talk page exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 1 }); // talk page content

      // archive -> archiveWithDirectPage:
      // getContentOrNull(archive)
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]); // archive doesn't exist

      // archiveParagraphs:
      // getContentOrNull(archive)
      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]); // archive still doesn't exist (create will be called)

      // getContent(talkPage) for removal
      wikiApi.info.mockResolvedValueOnce([{}]); // talk page exists
      wikiApi.articleContent.mockResolvedValueOnce({ content: pageContent, revid: 2 }); // talk page content

      model = UserTalkArchiveBotModel(wikiApi);

      await model.run();

      expect(wikiApi.getArticlesWithTemplate).toHaveBeenCalledWith('בוט ארכוב אוטומטי', undefined, 'תבנית', '*');
      expect(wikiApi.create).toHaveBeenCalledWith(
        'שיחת משתמש:דוגמה/ארכיון 1',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should skip pages without content', async () => {
      async function* mockGenerator() {
        yield [{
          pageid: 1,
          ns: 3,
          title: 'שיחת משתמש:דוגמה',
          extlinks: [],
        }];
      }

      wikiApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());
      model = UserTalkArchiveBotModel(wikiApi);

      await model.run();

      expect(consoleWarnSpy).toHaveBeenCalledWith('No content found for שיחת משתמש:דוגמה');
    });

    it('should skip pages with content but without valid config', async () => {
      const pageContent = `==דיון==
תוכן ללא תבנית`;

      async function* mockGenerator() {
        yield [{
          pageid: 1,
          ns: 3,
          title: 'שיחת משתמש:דוגמה',
          extlinks: [],
          revisions: [{
            user: 'test',
            size: 100,
            slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': pageContent } },
          }],
        }];
      }

      wikiApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());
      model = UserTalkArchiveBotModel(wikiApi);

      await model.run();

      expect(consoleWarnSpy).toHaveBeenCalledWith('No valid config found for שיחת משתמש:דוגמה');
    });

    it('should handle errors during page processing', async () => {
      const pageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]}}
==דיון==
תוכן`;

      async function* mockGenerator() {
        yield [{
          pageid: 1,
          ns: 3,
          title: 'שיחת משתמש:דוגמה',
          extlinks: [],
          revisions: [{
            user: 'test',
            size: 100,
            slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': pageContent } },
          }],
        }];
      }

      wikiApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());
      wikiApi.info.mockRejectedValue(new Error('API Error'));
      model = UserTalkArchiveBotModel(wikiApi);

      await model.run();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to process שיחת משתמש:דוגמה:',
        expect.any(Error),
      );
    });

    it('should process pages with no archivable paragraphs without archiving', async () => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));

      const pageContent = `{{בוט ארכוב אוטומטי|מיקום דף ארכיון אחרון=[[שיחת משתמש:דוגמה/ארכיון 1]]}}
==דיון חדש==
תוכן חדש
12:42, 30 בינואר 2025 (IDT)`;

      async function* mockGenerator() {
        yield [{
          pageid: 1,
          ns: 3,
          title: 'שיחת משתמש:דוגמה',
          extlinks: [],
          revisions: [{
            user: 'test',
            size: 100,
            slots: { main: { contentmodel: 'wikitext', contentformat: 'text/x-wiki', '*': pageContent } },
          }],
        }];
      }

      wikiApi.getArticlesWithTemplate.mockReturnValue(mockGenerator());
      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });
      model = UserTalkArchiveBotModel(wikiApi);

      await model.run();

      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
    });
  });
});
