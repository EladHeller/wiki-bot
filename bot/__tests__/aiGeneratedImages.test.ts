import {
  describe, beforeEach, afterEach, it, expect, jest,
} from '@jest/globals';

const mockRequest = jest.fn() as any;
const mockContinueQuery = jest.fn() as any;
const mockLogin = jest.fn() as any;
const mockArticleContent = jest.fn() as any;
const mockListCategory = jest.fn() as any;
const mockRecursiveSubCategories = jest.fn().mockImplementation(async function* mockRecursive() {
  yield* [];
}) as any;
const mockInfo = jest.fn() as any;
const mockEdit = jest.fn() as any;
const mockCreate = jest.fn() as any;

const mockHeWikiApi = {
  login: mockLogin,
  articleContent: mockArticleContent,
  listCategory: mockListCategory,
  recursiveSubCategories: mockRecursiveSubCategories,
  info: mockInfo,
  edit: mockEdit,
  create: mockCreate,
  request: mockRequest,
  continueQuery: mockContinueQuery,
};

const mockWikiApi = jest.fn(() => {
  throw new Error('Missing username or password');
}) as any;
const mockBaseWikiApi = jest.fn(() => {
  throw new Error('Missing username or password');
}) as any;

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: mockWikiApi,
}));

jest.unstable_mockModule('../wiki/BaseWikiApi', () => ({
  default: mockBaseWikiApi,
  defaultConfig: {},
}));

const { default: WikiApi } = await import('../wiki/WikiApi');
await import('../decorators/injectionDecorator');
const { default: AiGeneratedImagesModel } = await import('../maintenance/aiGeneratedImages/AiGeneratedImagesModel');
const { updateHebrewWikiList, main } = await import('../maintenance/aiGeneratedImages/index');
const { buildTable } = await import('../wiki/wikiTableParser');

const TARGET_PAGE = 'ויקיפדיה:תחזוקה/תמונות שנוצרו על ידי בינה מלאכותית';
const EDIT_SUMMARY = 'עדכון רשימת דפים עם תמונות בינה מלאכותית';

describe('ai generated images bot', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    mockWikiApi.mockImplementation(() => mockHeWikiApi);
    mockBaseWikiApi.mockImplementation(() => ({ login: mockLogin }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    mockWikiApi.mockImplementation(() => {
      throw new Error('Missing username or password');
    });
    mockBaseWikiApi.mockImplementation(() => {
      throw new Error('Missing username or password');
    });
  });

  describe('aiGeneratedImagesModel', () => {
    it('should fetch images and their global usage from Commons', async () => {
      const mockCommonsApi = {
        filesWithGlobalUsage: jest.fn().mockImplementation(async function* mockFiles() {
          yield [
            { title: 'File:AI1.jpg', globalusage: [{ wiki: 'he.wikipedia.org', title: 'Page1' }] },
            { title: 'File:AI2.jpg', globalusage: [{ wiki: 'he.wikipedia.org', title: 'Page2' }, { wiki: 'enwiki', title: 'Other' }] },
          ];
        }),
        recursiveSubCategories: jest.fn().mockImplementation(async function* mockRecursive() {
          yield* [];
        }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual(new Map([
        ['Page1', ['File:AI1.jpg']],
        ['Page2', ['File:AI2.jpg']],
      ]));
    });

    it('should handle subcategories recursively', async () => {
      const mockCommonsApi = {
        filesWithGlobalUsage: jest.fn()
          .mockImplementation(async function* mockFiles() {
            yield [{ title: 'File:Img.jpg', globalusage: [{ wiki: 'he.wikipedia.org', title: 'Page' }] }];
          }),
        recursiveSubCategories: jest.fn()
          .mockImplementation(async function* mockRecursive() {
            yield { title: 'Category:Sub' };
          }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual(new Map([
        ['Page', ['File:Img.jpg']],
      ]));
      expect(mockCommonsApi.filesWithGlobalUsage).toHaveBeenCalledTimes(2); // One for main category, one for Sub
    });

    it('should handle empty responses in continueQuery', async () => {
      const mockCommonsApi = {
        filesWithGlobalUsage: jest.fn().mockImplementation(async function* mockFiles() {
          yield [];
        }),
        recursiveSubCategories: jest.fn().mockImplementation(async function* mockRecursive() {
          yield* [];
        }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual(new Map());
    });

    it('should handle files without globalusage or without title', async () => {
      const mockCommonsApi = {
        filesWithGlobalUsage: jest.fn().mockImplementation(async function* mockFiles() {
          yield [
            { title: 'File:NoUsage.jpg' },
            { title: 'File:EmptyUsage.jpg', globalusage: [] },
            { title: 'File:NoTitle.jpg', globalusage: [{ wiki: 'he.wikipedia.org' }] },
            { title: 'File:OtherWiki.jpg', globalusage: [{ wiki: 'enwiki', title: 'Page' }] },
          ];
        }),
        recursiveSubCategories: jest.fn().mockImplementation(async function* mockRecursive() {
          yield* [];
        }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual(new Map());
    });

    it('should ignore duplicate files for the same page', async () => {
      const mockCommonsApi = {
        filesWithGlobalUsage: jest.fn().mockImplementation(async function* mockFiles() {
          yield [{ title: 'File:AI1.jpg', globalusage: [{ wiki: 'he.wikipedia.org', title: 'Page' }] }];
          yield [{ title: 'File:AI1.jpg', globalusage: [{ wiki: 'he.wikipedia.org', title: 'Page' }] }];
        }),
        recursiveSubCategories: jest.fn().mockImplementation(async function* mockRecursive() {
          yield* [];
        }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual(new Map([
        ['Page', ['File:AI1.jpg']],
      ]));
    });
  });

  describe('updateHebrewWikiList', () => {
    it('should update Hebrew Wikipedia list', async () => {
      const pagesWithAiImages = new Map<string, string[]>([
        ['Page1', ['File:AI1.jpg']],
      ]);

      mockArticleContent.mockResolvedValue({ content: 'Existing content', revid: 123 });

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Page1'),
        123,
      );
    });

    it('should update only the table and date in existing content', async () => {
      const pagesWithAiImages = new Map<string, string[]>([
        ['Page1', ['File:AI1.jpg']],
      ]);
      const existingContent = `Header
הנתונים נכונים ל-01/01/2024.
{| class="wikitable"
! דף !! תמונות
|-
| [[OldPage]] || [[:File:Old.jpg|Old.jpg]]
|}
Footer`;

      mockArticleContent.mockResolvedValue({ content: existingContent, revid: 123 });

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Header'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Footer'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Page1'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.not.stringContaining('OldPage'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringMatching(/הנתונים נכונים ל-\d{1,2}.\d{1,2}.\d{4}/),
        123,
      );
    });

    it('should not update if content is the same', async () => {
      const pagesWithAiImages = new Map<string, string[]>([
        ['Page1', ['File:AI1.jpg']],
      ]);
      const dateStr = new Date().toLocaleDateString('he-IL');
      const table = buildTable(['דף', 'תמונות'], [['[[Page1]]', '[[:File:AI1.jpg|AI1.jpg]]']]);
      const existingContent = `הנתונים נכונים ל-${dateStr}.\n${table}`;

      mockArticleContent.mockResolvedValue({ content: existingContent, revid: 123 });

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('No changes detected in AI-generated images list.');
    });

    it('should append table and date when current content lacks a table', async () => {
      const pagesWithAiImages = new Map<string, string[]>([
        ['Page1', ['File:AI1.jpg']],
      ]);
      mockArticleContent.mockResolvedValue({ content: 'Just some text', revid: 123 });

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Just some text'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Page1'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('הנתונים נכונים ל-'),
        123,
      );
    });

    it('should replace the table even when the date line is missing', async () => {
      const pagesWithAiImages = new Map<string, string[]>([
        ['Page1', ['File:AI1.jpg']],
      ]);
      const existingContent = `{| class="wikitable"
! דף !! תמונות
|-
| [[OldPage]] || [[:File:Old.jpg|Old.jpg]]
|}`;

      mockArticleContent.mockResolvedValue({ content: existingContent, revid: 123 });

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Page1'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.not.stringContaining('OldPage'),
        123,
      );
    });

    it('should handle entries with undefined image lists', async () => {
      const pagesWithAiImages = new Map<string, string[]>();
      pagesWithAiImages.set('Page1', undefined as unknown as string[]);

      mockArticleContent.mockResolvedValue({ content: 'Header', revid: 123 });

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Page1'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('הנתונים נכונים ל-'),
        123,
      );
    });

    it('should treat missing article content as empty string', async () => {
      const pagesWithAiImages = new Map<string, string[]>([
        ['Page1', ['File:AI1.jpg']],
      ]);
      mockArticleContent.mockResolvedValue({ revid: 123 });

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('Page1'),
        123,
      );
      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.stringContaining('הנתונים נכונים ל-'),
        123,
      );
    });
  });

  describe('main', () => {
    it('should coordinate the process', async () => {
      const mockCommonsApi = {
        login: (jest.fn() as any).mockResolvedValue(undefined),
        filesWithGlobalUsage: jest.fn().mockImplementation(async function* mockFiles() {
          yield [{ title: 'File:AI.jpg', globalusage: [{ wiki: 'he.wikipedia.org', title: 'Page' }] }];
        }),
        recursiveSubCategories: jest.fn().mockImplementation(async function* mockRecursive() {
          yield* [];
        }),
      };

      (WikiApi as any).mockReturnValueOnce(mockHeWikiApi); // for botLoggerDecorator
      (WikiApi as any).mockReturnValueOnce(mockHeWikiApi); // for injectionDecorator
      (WikiApi as any).mockReturnValueOnce(mockCommonsApi); // for aiGeneratedImagesBot
      mockArticleContent.mockResolvedValue({ content: '', revid: 123 });

      await main();

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should handle non-existent page by creating it', async () => {
      const mockCommonsApi = {
        login: (jest.fn() as any).mockResolvedValue(undefined),
        filesWithGlobalUsage: jest.fn().mockImplementation(async function* mockFiles() {
          yield [{ title: 'File:AI.jpg', globalusage: [{ wiki: 'he.wikipedia.org', title: 'Page' }] }];
        }),
        recursiveSubCategories: jest.fn().mockImplementation(async function* mockRecursive() {
          yield* [];
        }),
      };

      (WikiApi as any).mockReturnValueOnce(mockHeWikiApi); // for botLoggerDecorator
      (WikiApi as any).mockReturnValueOnce(mockHeWikiApi); // for injectionDecorator
      (WikiApi as any).mockReturnValueOnce(mockCommonsApi); // for aiGeneratedImagesBot
      mockArticleContent.mockResolvedValue({ content: '', revid: 0 });

      await main();

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        EDIT_SUMMARY,
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should log and throw error if main fails', async () => {
      mockLogin.mockRejectedValueOnce(new Error('API Fail'));

      await expect(main()).rejects.toThrow('API Fail');
    });
  });
});
