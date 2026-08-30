import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import NewCategoriesModel from '../maintenance/newCategories/model';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

const yearlyCategoriesParent = 'קטגוריה:ויקיפדיה:קטגוריות לפי זמן יצירתם';

function mockCategorySearch(api: ReturnType<typeof WikiApiMock>, batches: string[][]) {
  api.searchPages.mockImplementation(async function* searchPages() {
    yield* batches.map((titles) => titles.map((title) => ({ title })) as any);
  });
}

describe('new categories model', () => {
  let api: ReturnType<typeof WikiApiMock>;

  beforeEach(() => {
    api = WikiApiMock();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gets all categories created in a month and sorts them', async () => {
    mockCategorySearch(api, [['קטגוריה:ג', 'קטגוריה:א'], ['קטגוריה:ב']]);

    const categories = await NewCategoriesModel(api).getCategoriesCreatedIn('2027-02');

    expect(categories).toStrictEqual(['קטגוריה:א', 'קטגוריה:ב', 'קטגוריה:ג']);
    expect(api.searchPages).toHaveBeenCalledWith('creationdate:2027-02', [14], 500);
  });

  it('updates the current month categories when the content changed', async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    mockCategorySearch(api, [['קטגוריה:ב', 'קטגוריה:א']]);
    api.articleContent.mockResolvedValue({
      content: 'פתיח\n* [[:קטגוריה:ישן]]\nסיום',
      revid: 123,
    });

    await NewCategoriesModel(api).updateNewCategories();

    expect(api.searchPages).toHaveBeenCalledWith(`creationdate:${currentMonth}`, [14], 500);
    expect(api.edit).toHaveBeenCalledWith(
      'ויקיפדיה:קטגוריות חדשות',
      'עדכון קטגוריות חדשות',
      'פתיח\n* [[:קטגוריה:א]]\n* [[:קטגוריה:ב]]\nסיום',
      123,
    );
  });

  it('does not update the current month categories when the content is unchanged', async () => {
    mockCategorySearch(api, [['קטגוריה:א']]);
    api.articleContent.mockResolvedValue({
      content: 'פתיח\n* [[:קטגוריה:א]]\nסיום',
      revid: 123,
    });

    await NewCategoriesModel(api).updateNewCategories();

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('does nothing when the requested month page already exists', async () => {
    api.info.mockResolvedValue([{ pageid: 1 }]);

    await NewCategoriesModel(api).createPerMonthIfNeeded(new Date('2027-02-01T00:00:00.000Z'));

    expect(api.info).toHaveBeenCalledWith(['ויקיפדיה:קטגוריות לפי זמן יצירתם/פברואר 2027']);
    expect(api.info).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.searchPages).not.toHaveBeenCalled();
  });

  it('creates a missing year category before creating its first month page', async () => {
    api.info
      .mockResolvedValueOnce([{ missing: '' }])
      .mockResolvedValueOnce([{ missing: '' }]);
    mockCategorySearch(api, [['קטגוריה:ב', 'קטגוריה:א']]);

    await NewCategoriesModel(api).createPerMonthIfNeeded(new Date('2027-02-01T00:00:00.000Z'));

    expect(api.create).toHaveBeenNthCalledWith(
      1,
      `${yearlyCategoriesParent} (2027)`,
      'יצירת קטגוריה לשנת 2027',
      `[[${yearlyCategoriesParent}]]`,
    );
    expect(api.create).toHaveBeenNthCalledWith(
      2,
      'ויקיפדיה:קטגוריות לפי זמן יצירתם/פברואר 2027',
      'קטגוריות שנוצרו בחודש פברואר 2027',
      [
        'בחודש פברואר 2027 נוצרו 2 קטגוריות:',
        '* [[:קטגוריה:א]]',
        '* [[:קטגוריה:ב]]',
        '',
        `[[${yearlyCategoriesParent} (2027)]]`,
      ].join('\n'),
    );
  });

  it('uses the existing year category when editing a month page', async () => {
    api.info
      .mockResolvedValueOnce([{ lastrevid: 456 }])
      .mockResolvedValueOnce([{ pageid: 2 }]);
    mockCategorySearch(api, [[]]);

    await NewCategoriesModel(api).createPerMonthIfNeeded(new Date('2027-02-01T00:00:00.000Z'), true);

    expect(api.create).not.toHaveBeenCalled();
    expect(api.edit).toHaveBeenCalledWith(
      'ויקיפדיה:קטגוריות לפי זמן יצירתם/פברואר 2027',
      'קטגוריות שנוצרו בחודש פברואר 2027',
      `בחודש פברואר 2027 נוצרו 0 קטגוריות:\n\n\n[[${yearlyCategoriesParent} (2027)]]`,
      456,
    );
  });

  it('uses a fallback revision when explicitly editing a missing month page', async () => {
    api.info
      .mockResolvedValueOnce([{ missing: '' }])
      .mockResolvedValueOnce([{ pageid: 2 }]);
    mockCategorySearch(api, [[]]);

    await NewCategoriesModel(api).createPerMonthIfNeeded(new Date('2027-02-01T00:00:00.000Z'), true);

    expect(api.edit).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      -1,
    );
  });

  it('does nothing when the requested year page already exists', async () => {
    api.info.mockResolvedValue([{ pageid: 1 }]);

    await NewCategoriesModel(api).createPerYearIfNeeded(new Date('2026-01-01T00:00:00.000Z'));

    expect(api.info).toHaveBeenCalledWith(['ויקיפדיה:קטגוריות לפי זמן יצירתם/2026']);
    expect(api.info).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.searchPages).not.toHaveBeenCalled();
  });

  it('creates a complete year page and its missing category', async () => {
    api.info
      .mockResolvedValueOnce([{ missing: '' }])
      .mockResolvedValueOnce([{ missing: '' }]);
    mockCategorySearch(api, [['קטגוריה:ב', 'קטגוריה:א']]);

    await NewCategoriesModel(api).createPerYearIfNeeded(new Date('2026-01-01T00:00:00.000Z'));

    expect(api.searchPages).toHaveBeenCalledWith('creationdate:2026', [14], 500);
    expect(api.create).toHaveBeenNthCalledWith(
      1,
      `${yearlyCategoriesParent} (2026)`,
      'יצירת קטגוריה לשנת 2026',
      `[[${yearlyCategoriesParent}]]`,
    );
    expect(api.create).toHaveBeenNthCalledWith(
      2,
      'ויקיפדיה:קטגוריות לפי זמן יצירתם/2026',
      'קטגוריות שנוצרו בשנת 2026',
      [
        'בשנת 2026 נוצרו 2 קטגוריות:',
        '* [[:קטגוריה:א]]',
        '* [[:קטגוריה:ב]]',
        '',
        `[[${yearlyCategoriesParent} (2026)]]`,
      ].join('\n'),
    );
  });

  it('uses the existing year category when editing a year page', async () => {
    api.info
      .mockResolvedValueOnce([{ lastrevid: 789 }])
      .mockResolvedValueOnce([{ pageid: 2 }]);
    mockCategorySearch(api, [[]]);

    await NewCategoriesModel(api).createPerYearIfNeeded(new Date('2026-01-01T00:00:00.000Z'), true);

    expect(api.create).not.toHaveBeenCalled();
    expect(api.edit).toHaveBeenCalledWith(
      'ויקיפדיה:קטגוריות לפי זמן יצירתם/2026',
      'קטגוריות שנוצרו בשנת 2026',
      `בשנת 2026 נוצרו 0 קטגוריות:\n\n\n[[${yearlyCategoriesParent} (2026)]]`,
      789,
    );
  });

  it('uses a fallback revision when explicitly editing a missing year page', async () => {
    api.info
      .mockResolvedValueOnce([{ missing: '' }])
      .mockResolvedValueOnce([{ pageid: 2 }]);
    mockCategorySearch(api, [[]]);

    await NewCategoriesModel(api).createPerYearIfNeeded(new Date('2026-01-01T00:00:00.000Z'), true);

    expect(api.edit).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      -1,
    );
  });

  it('requests the previous month when creating the monthly archive', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-15T12:00:00.000Z'));
    api.info.mockResolvedValue([{ pageid: 1 }]);

    await NewCategoriesModel(api).createLastMonthCategoriesPageIfNeeded();

    expect(api.info).toHaveBeenCalledWith(['ויקיפדיה:קטגוריות לפי זמן יצירתם/דצמבר 2026']);
  });

  it('requests the previous year when creating the yearly archive', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-08-30T12:00:00.000Z'));
    api.info.mockResolvedValue([{ pageid: 1 }]);

    await NewCategoriesModel(api).createLastYearCategoriesPageIfNeeded();

    expect(api.info).toHaveBeenCalledWith(['ויקיפדיה:קטגוריות לפי זמן יצירתם/2026']);
  });
});
