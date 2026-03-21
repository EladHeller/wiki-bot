import {
  describe, beforeEach, it, expect, jest,
} from '@jest/globals';

const mockRequest = jest.fn() as any;
const mockContinueQuery = jest.fn() as any;
const mockLogin = jest.fn() as any;
const mockArticleContent = jest.fn() as any;
const mockListCategory = jest.fn() as any;
const mockInfo = jest.fn() as any;
const mockEdit = jest.fn() as any;
const mockCreate = jest.fn() as any;

const mockHeWikiApi = {
  login: mockLogin,
  articleContent: mockArticleContent,
  listCategory: mockListCategory,
  info: mockInfo,
  edit: mockEdit,
  create: mockCreate,
  request: mockRequest,
  continueQuery: mockContinueQuery,
};

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: jest.fn().mockReturnValue(mockHeWikiApi),
}));

jest.unstable_mockModule('../wiki/BaseWikiApi', () => ({
  default: jest.fn().mockReturnValue({ login: mockLogin }),
  defaultConfig: {},
}));

const { default: AiGeneratedImagesModel } = await import('../maintenance/aiGeneratedImages/AiGeneratedImagesModel');
const { updateHebrewWikiList, main } = await import('../maintenance/aiGeneratedImages/index');
const { logger } = await import('../utilities/logger');
const { buildTable } = await import('../wiki/wikiTableParser');

const TARGET_PAGE = 'ויקיפדיה:תחזוקה/תמונות שנוצרו על ידי בינה מלאכותית';

describe('ai generated images bot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('aiGeneratedImagesModel', () => {
    it('should fetch images and their global usage from Commons', async () => {
      const mockCommonsApi = {
        continueQuery: jest.fn().mockImplementation(async function* mockContinue(path: string, callback: any) {
          const result = {
            query: {
              pages: {
                1: { title: 'File:AI1.jpg', globalusage: [{ wiki: 'hewiki', title: 'Page1' }] },
                2: { title: 'File:AI2.jpg', globalusage: [{ wiki: 'hewiki', title: 'Page2' }, { wiki: 'enwiki', title: 'Other' }] },
              },
            },
          };
          yield callback(result);
        }),
        listCategory: jest.fn().mockImplementation(async function* mockList() {
          yield [];
        }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual({
        Page1: ['File:AI1.jpg'],
        Page2: ['File:AI2.jpg'],
      });
    });

    it('should handle subcategories recursively and avoid cycles', async () => {
      const mockCommonsApi = {
        continueQuery: jest.fn()
          .mockImplementation(async function* mockContinue(path: string, callback: any) {
            yield callback({ query: { pages: { 1: { title: 'File:Img.jpg', globalusage: [{ wiki: 'hewiki', title: 'Page' }] } } } });
          }),
        listCategory: jest.fn()
          .mockImplementationOnce(async function* mockList1() {
            yield [{ title: 'Category:Sub' }];
          })
          .mockImplementationOnce(async function* mockList2() {
            yield [{ title: 'Category:AI-generated images' }]; // Cycle
          })
          .mockImplementationOnce(async function* mockList3() {
            yield [{ title: 'Category:Sub' }]; // Already seen
          })
          .mockImplementation(async function* mockListEmpty() {
            yield [];
          }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual({
        Page: ['File:Img.jpg'],
      });
      // Initial call + 1 subcat call. The third call (cycle) and fourth (duplicate) should return immediately.
      expect(mockCommonsApi.listCategory).toHaveBeenCalledTimes(2);
    });

    it('should handle empty responses in continueQuery', async () => {
      const mockCommonsApi = {
        continueQuery: jest.fn().mockImplementation(async function* mockContinue(path: string, callback: any) {
          yield callback({});
          yield callback({ query: {} });
        }),
        listCategory: jest.fn().mockImplementation(async function* mockList() { yield []; }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual({});
    });

    it('should handle files without globalusage or without title', async () => {
      const mockCommonsApi = {
        continueQuery: jest.fn().mockImplementation(async function* mockContinue(path: string, callback: any) {
          yield callback({
            query: {
              pages: {
                1: { title: 'File:NoUsage.jpg' },
                2: { title: 'File:EmptyUsage.jpg', globalusage: [] },
                3: { title: 'File:NoTitle.jpg', globalusage: [{ wiki: 'hewiki' }] },
              },
            },
          });
        }),
        listCategory: jest.fn().mockImplementation(async function* mockList() { yield []; }),
      } as any;

      const model = AiGeneratedImagesModel(mockCommonsApi);
      const result = await model.getAiGeneratedImagesFromCommons();

      expect(result).toStrictEqual({});
    });
  });

  describe('updateHebrewWikiList', () => {
    it('should update Hebrew Wikipedia list', async () => {
      const pagesWithAiImages = {
        Page1: ['File:AI1.jpg'],
      };

      mockArticleContent.mockResolvedValue({ content: 'Old content', revid: 123 });
      mockEdit.mockResolvedValue({});

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).toHaveBeenCalledWith(
        TARGET_PAGE,
        'עדכון רשימת דפים עם תמונות בינה מלאכותית',
        expect.stringContaining('[[Page1]]'),
        123,
      );
    });

    it('should handle error when getting article content and create new', async () => {
      const pagesWithAiImages = { Page1: ['File:AI1.jpg'] };
      mockArticleContent.mockRejectedValue(new Error('Page not found'));
      mockCreate.mockResolvedValue({});

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockCreate).toHaveBeenCalledWith(
        TARGET_PAGE,
        'עדכון רשימת דפים עם תמונות בינה מלאכותית',
        expect.any(String),
      );
    });

    it('should not update if content is the same', async () => {
      const pagesWithAiImages = {
        Page1: ['File:AI1.jpg'],
      };

      let content = 'דף זה מכיל רשימה של דפים בוויקיפדיה העברית המשתמשים בתמונות שנוצרו על ידי בינה מלאכותית מוויקישיתוף.\n\n';
      content += `הנתונים נכונים ל-${new Date().toLocaleDateString('he-IL')}.\n\n`;
      content += buildTable(['דף', 'תמונות'], [['[[Page1]]', '[[:File:AI1.jpg|AI1.jpg]]']]);

      mockArticleContent.mockResolvedValue({ content, revid: 123 });

      const logInfoSpy = jest.spyOn(logger, 'logInfo');

      await updateHebrewWikiList(pagesWithAiImages, mockHeWikiApi as any);

      expect(mockEdit).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(logInfoSpy).toHaveBeenCalledWith('No changes detected in AI-generated images list.');
    });
  });

  describe('main', () => {
    it('should coordinate the process', async () => {
      mockContinueQuery.mockImplementation(async function* mockContinue(path: string, callback: any) {
        yield callback({ query: { pages: { 1: { title: 'File:AI.jpg', globalusage: [{ wiki: 'hewiki', title: 'Page' }] } } } });
      });
      mockListCategory.mockImplementation(async function* mockList() { yield []; });
      mockArticleContent.mockResolvedValue({ content: '', revid: 0 });
      mockCreate.mockResolvedValue({});
      mockLogin.mockResolvedValue({});

      await main();

      expect(mockCreate).toHaveBeenCalledWith(
        TARGET_PAGE,
        'עדכון רשימת דפים עם תמונות בינה מלאכותית',
        expect.any(String),
      );
    });

    it('should log and throw error if main fails', async () => {
      mockContinueQuery.mockImplementation(() => { throw new Error('API Fail'); });

      await expect(main()).rejects.toThrow('API Fail');
    });
  });
});
