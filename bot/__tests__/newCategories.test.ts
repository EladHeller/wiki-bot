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

  describe('deleted categories for talk pages created in a year', () => {
    function deletionResponse(timestamp = '2027-05-01T00:00:00Z', createdAt = '2026-06-01T00:00:00Z') {
      return {
        query: {
          pages: { 1: { revisions: [{ timestamp: createdAt }] } },
          logevents: [{ timestamp }],
        },
      };
    }

    it('checks every batch, preserves colons, sorts and deduplicates deleted categories', async () => {
      mockCategorySearch(api, [
        ['שיחת קטגוריה:ג', 'שיחת קטגוריה:ג', 'שיחת קטגוריה:קיימת', 'שיחת קטגוריה:שוחזרה'],
        [],
        ['שיחת קטגוריה:ג'],
        ['שיחת קטגוריה:א:ב'],
      ]);
      api.info.mockResolvedValueOnce([
        { title: 'קטגוריה:שוחזרה', pageid: 3 },
        { title: 'קטגוריה:קיימת', pageid: 2 },
        { title: 'קטגוריה:ג', missing: '' },
      ]).mockResolvedValueOnce([{ title: 'קטגוריה:א:ב', missing: '' }]);
      api.request.mockResolvedValue(deletionResponse());

      const result = await NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026);

      expect(result).toStrictEqual(['קטגוריה:א:ב', 'קטגוריה:ג']);
      expect(api.searchPages).toHaveBeenCalledWith('creationdate:2026', [15], 500);
      expect(api.info.mock.calls).toStrictEqual([
        [['קטגוריה:ג', 'קטגוריה:קיימת', 'קטגוריה:שוחזרה']],
        [['קטגוריה:א:ב']],
      ]);

      const params = new URLSearchParams(api.request.mock.calls[1][0]);

      expect(Object.fromEntries(params)).toStrictEqual({
        action: 'query',
        format: 'json',
        prop: 'revisions',
        titles: 'שיחת קטגוריה:א:ב',
        rvprop: 'timestamp',
        rvlimit: '1',
        rvdir: 'newer',
        list: 'logevents',
        leaction: 'delete/delete',
        leprop: 'timestamp',
        lelimit: '1',
        ledir: 'older',
        letitle: 'קטגוריה:א:ב',
      });
      expect({
        requests: api.request.mock.calls.length,
        edits: api.edit.mock.calls,
        creations: api.create.mock.calls,
        deletions: api.deletePage.mock.calls,
      }).toStrictEqual({
        requests: 2, edits: [], creations: [], deletions: [],
      });
    });

    it.each([
      [50, [50]],
      [51, [50, 1]],
      [101, [50, 50, 1]],
      [500, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50]],
    ] as const)('checks all %s categories in info batches of at most 50', async (count, batchSizes) => {
      const titles = Array.from({ length: count }, (_, index) => `קטגוריה:${index}`);
      mockCategorySearch(api, [titles.map((title) => title.replace(/^קטגוריה:/, 'שיחת קטגוריה:'))]);
      api.info.mockImplementation(async (batch) => batch.map((title) => ({ title, missing: '' })));
      api.request.mockResolvedValue(deletionResponse());

      const result = await NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026);

      expect(api.info.mock.calls.map(([batch]) => batch.length)).toStrictEqual(batchSizes);
      expect(api.info.mock.calls.flatMap(([batch]) => batch)).toStrictEqual(titles);
      expect(result).toStrictEqual([...titles].sort((a, b) => a.localeCompare(b)));
    });

    it.each([
      ['no deletion history', { query: { ...deletionResponse().query, logevents: [] } }],
      ['no logs returned', { query: { pages: deletionResponse().query.pages } }],
      ['hidden timestamp', { query: { ...deletionResponse().query, logevents: [{}] } }],
      ['deletion before talk creation', deletionResponse('2026-05-01T00:00:00Z')],
      ['creation outside requested year', deletionResponse('2027-05-01T00:00:00Z', '2025-06-01T00:00:00Z')],
    ])('excludes a missing category with %s', async (_description, response) => {
      mockCategorySearch(api, [['שיחת קטגוריה:א']]);
      api.info.mockResolvedValue([{ title: 'קטגוריה:א', missing: '' }]);
      api.request.mockResolvedValue(response);

      await expect(NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026)).resolves.toStrictEqual([]);
    });

    it.each([
      {},
      { query: {} },
      { query: { pages: {} } },
      { query: { pages: { 1: {} } } },
      { query: { pages: { 1: { revisions: [] } } } },
      { query: { pages: { 1: { revisions: [{}] } } } },
    ])('rejects when the talk creation date cannot be checked: %j', async (response) => {
      mockCategorySearch(api, [['שיחת קטגוריה:א']]);
      api.info.mockResolvedValue([{ title: 'קטגוריה:א', missing: '' }]);
      api.request.mockResolvedValue(response);

      await expect(NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026))
        .rejects.toThrow('Could not determine creation date for שיחת קטגוריה:א');
    });

    it('ignores missing info without a title', async () => {
      mockCategorySearch(api, [['שיחת קטגוריה:א']]);
      api.info.mockResolvedValue([{ missing: '' }]);

      await expect(NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026)).resolves.toStrictEqual([]);
      expect(api.request).not.toHaveBeenCalled();
    });

    it('returns an empty list without querying info when no talk pages match', async () => {
      mockCategorySearch(api, []);

      await expect(NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026)).resolves.toStrictEqual([]);
      expect(api.info).not.toHaveBeenCalled();
    });

    it('does not turn API failures into an incomplete result', async () => {
      mockCategorySearch(api, [['שיחת קטגוריה:א'], ['שיחת קטגוריה:ב']]);
      api.info.mockResolvedValueOnce([{ title: 'קטגוריה:א', missing: '' }])
        .mockRejectedValueOnce(new Error('API failed'));
      api.request.mockResolvedValue(deletionResponse());

      await expect(NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(2026))
        .rejects.toThrow('API failed');
    });

    it.each([0, -1, 2026.5, Number.NaN, Number.POSITIVE_INFINITY, 10000])('rejects invalid year %s', async (year) => {
      await expect(NewCategoriesModel(api).getDeletedCategoriesForTalkPagesCreatedIn(year))
        .rejects.toThrow('Year must be an integer between 1 and 9999');
      expect(api.searchPages).not.toHaveBeenCalled();
    });
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
