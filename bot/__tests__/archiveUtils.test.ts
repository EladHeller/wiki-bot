import {
  beforeEach, describe, expect, it,
} from '@jest/globals';
import {
  getArchiveTitle,
  getLastActiveArchiveLink,
  getUndatedParagraphsToArchive,
  removeArchivedUndatedParagraphsFromTracker,
} from '../utilities/archiveUtils';
import { IWikiApi } from '../wiki/WikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('archiveUtils', () => {
  let wikiApi: Mocked<IWikiApi>;

  beforeEach(() => {
    wikiApi = WikiApiMock();
  });

  describe('getLastActiveArchiveLink', () => {
    it('should return the last active archive link', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[/ארכיון 2]]
[[/ארכיון 3]]
`;

      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);
      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBe('TestPage/ארכיון 2');
    });

    it('should return null when no active archive found', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[/ארכיון 2]]
`;

      wikiApi.info.mockResolvedValue([{ missing: '' }]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBeNull();
    });

    it('should skip non-matching prefixes when matchPrefix is true', async () => {
      const archiveBoxContent = `
[[OtherPage/ארכיון 1]]
[[/ארכיון 1]]
[[/ארכיון 2]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', true);

      expect(result).toBe('TestPage/ארכיון 2');
      expect(wikiApi.info).toHaveBeenCalledTimes(1);
      expect(wikiApi.info).toHaveBeenCalledWith(['TestPage/ארכיון 2']);
    });

    it('should check all links when matchPrefix is false', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[OtherPage/ארכיון 1]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBe('OtherPage/ארכיון 1');
    });

    it('should handle absolute links', async () => {
      const archiveBoxContent = `
[[OtherPage/ארכיון 1]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBe('OtherPage/ארכיון 1');
    });

    it('should use default matchPrefix value of false', async () => {
      const archiveBoxContent = `
[[/ארכיון 1]]
[[OtherPage/ארכיון 1]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage');

      expect(result).toBe('OtherPage/ארכיון 1');
    });

    it('should handle archive link with trailing slash', async () => {
      const archiveBoxContent = `
[[/ארכיון 1/]]
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', false);

      expect(result).toBe('TestPage/ארכיון 1');
      expect(wikiApi.info).toHaveBeenCalledWith(['TestPage/ארכיון 1']);
    });

    it('should return null when matchPrefix is true and no links match the prefix', async () => {
      const archiveBoxContent = `
[[OtherPage/ארכיון 1]]
[[SomePage/ארכיון 2]]
[[DifferentPage/ארכיון 3]]
`;

      const result = await getLastActiveArchiveLink(wikiApi, archiveBoxContent, 'TestPage', true);

      expect(result).toBeNull();
      expect(wikiApi.info).not.toHaveBeenCalled();
    });
  });

  describe('getArchiveTitle', () => {
    it('should return archive title when archive box exists', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
[[/ארכיון 2]]
}}
Some content
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ archiveTitle: 'TestPage/ארכיון 2' });
    });

    it('should return error when archive box not found', async () => {
      const pageContent = 'No archive box here';

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ error: 'תיבת ארכיון לא נמצאה' });
    });

    it('should return error when archive box content is empty', async () => {
      const pageContent = '{{תיבת ארכיון}}';

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ error: 'התוכן של תיבת הארכיון לא נמצא' });
    });

    it('should return error when no active archive found', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
}}
`;

      wikiApi.info.mockResolvedValueOnce([{ missing: '' }]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ error: 'לא נמצא דף ארכיון פעיל' });
    });

    it('should use matchPrefix when specified', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[OtherPage/ארכיון 1]]
[[/ארכיון 1]]
}}
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', true);

      expect(result).toStrictEqual({ archiveTitle: 'TestPage/ארכיון 1' });
      expect(wikiApi.info).toHaveBeenCalledWith(['TestPage/ארכיון 1']);
    });

    it('should use default matchPrefix value of false', async () => {
      const pageContent = `
{{תיבת ארכיון|
[[/ארכיון 1]]
[[OtherPage/ארכיון 1]]
}}
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage');

      expect(result).toStrictEqual({ archiveTitle: 'OtherPage/ארכיון 1' });
    });

    it('should return archive title when auto archive box exists', async () => {
      const pageContent = `
{{תיבת ארכיון אוטומטי|
[[/ארכיון 1]]
[[/ארכיון 2]]
}}
`;

      wikiApi.info.mockResolvedValueOnce([{}]);

      const result = await getArchiveTitle(wikiApi, pageContent, 'TestPage', false);

      expect(result).toStrictEqual({ archiveTitle: 'TestPage/ארכיון 2' });
    });
  });

  describe('undated paragraphs tracker', () => {
    const undatedParagraph = '\n==Discussion 1==\nNo parsable date\n';
    const trackerPageTitle = 'ויקיפדיה:בוט/ארכוב פסקאות ללא תאריך';

    it('should add paragraph to tracker when first seen', async () => {
      wikiApi.info.mockResolvedValue([{ missing: '' }]);

      const result = await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      expect(result).toStrictEqual([]);
      expect(wikiApi.create).toHaveBeenCalledTimes(1);
      expect(wikiApi.create).toHaveBeenCalledWith(
        trackerPageTitle,
        'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך',
        expect.stringContaining('TestPage'),
      );
      expect(wikiApi.create).toHaveBeenCalledWith(
        trackerPageTitle,
        'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך',
        expect.stringContaining('Discussion 1'),
      );
    });

    it('should return tracked paragraph when inactivity time passed', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || 2000-01-01
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      const result = await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.paragraph).toBe(undatedParagraph);
      expect(result[0]?.paragraphTitle).toBe('Discussion 1');
      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should keep tracked paragraph unarchived when inactivity time did not pass yet', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || 2999-01-01
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      const result = await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      expect(result).toStrictEqual([]);
      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should return tracked paragraph when archive month arrived', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || 2025-02-03
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      const result = await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'archiveMonth', archiveMonthDate: new Date('2025-02-01T00:00:00Z') },
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.paragraph).toBe(undatedParagraph);
    });

    it('should remove paragraph from tracker after successful archive', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || 2025-02-03
|-
| TestPage || Discussion 2 || 2025-02-04
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      await removeArchivedUndatedParagraphsFromTracker(
        wikiApi,
        'TestPage',
        [undatedParagraph],
      );

      expect(wikiApi.edit).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledWith(
        trackerPageTitle,
        'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך',
        expect.not.stringContaining('Discussion 1'),
        1,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        trackerPageTitle,
        'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך',
        expect.stringContaining('Discussion 2'),
        1,
      );
    });

    it('should sort tracker rows by date then page title then paragraph title', async () => {
      wikiApi.info.mockResolvedValue([{ missing: '' }]);

      await getUndatedParagraphsToArchive(
        wikiApi,
        'ZetaPage',
        ['\n==Item==\nNo date\n'],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      const trackerAfterFirst = (wikiApi.create.mock.calls[0] as string[])[2];
      wikiApi.create.mockClear();
      wikiApi.info.mockReset();
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerAfterFirst, revid: 1 });

      await getUndatedParagraphsToArchive(
        wikiApi,
        'AlphaPage',
        ['\n==Item==\nNo date\n'],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      const savedContent = (wikiApi.edit.mock.calls[0] as string[])[2];
      const alphaPageIndex = savedContent.indexOf('AlphaPage');
      const zetaPageIndex = savedContent.indexOf('ZetaPage');

      expect(alphaPageIndex).toBeGreaterThan(-1);
      expect(zetaPageIndex).toBeGreaterThan(-1);
      expect(alphaPageIndex).toBeLessThan(zetaPageIndex);
    });

    it('should reset invalid date in tracker row to today', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || not-a-date
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      const result = await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      expect(result).toStrictEqual([]);
      expect(wikiApi.edit).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledWith(
        trackerPageTitle,
        'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך',
        expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
        1,
      );
    });

    it('should sort by paragraph title when date and page are equal', async () => {
      wikiApi.info.mockResolvedValue([{ missing: '' }]);

      await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        ['\n==Zeta==\nNo date\n', '\n==Alpha==\nNo date\n'],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      const savedContent = (wikiApi.create.mock.calls[0] as string[])[2];

      expect(savedContent.indexOf('Alpha')).toBeLessThan(savedContent.indexOf('Zeta'));
    });

    it('should sort by date before page and paragraph titles', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| ZetaPage || Zeta || 2025-03-10
|-
| AlphaPage || Alpha || 2025-03-15
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      await getUndatedParagraphsToArchive(
        wikiApi,
        'MiddlePage',
        ['\n==Middle==\nNo date\n'],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      const savedContent = (wikiApi.edit.mock.calls[0] as string[])[2];

      expect(savedContent.indexOf('2025-03-10')).toBeLessThan(savedContent.indexOf('2025-03-15'));
    });

    it('should skip save when tracker content already matches', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const alreadyUpdatedContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה

|-
|TestPage || Discussion 1 || ${today}
|}`;
      const invalidDateContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה

|-
|TestPage || Discussion 1 || not-a-date
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValueOnce({ content: invalidDateContent, revid: 1 });
      wikiApi.articleContent.mockResolvedValueOnce({ content: alreadyUpdatedContent, revid: 2 });

      await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      console.log('EXPECTED:', alreadyUpdatedContent);
      console.log('ACTUAL:', wikiApi.edit.mock.calls[0]?.[2]);

      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should not update tracker when removing paragraphs with no parseable title', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion 1 || 2025-02-03
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      await removeArchivedUndatedParagraphsFromTracker(
        wikiApi,
        'TestPage',
        ['paragraph without header'],
      );

      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should not update tracker when removing paragraphs not found in tracker', async () => {
      const trackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || Discussion A || 2025-02-03
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContent, revid: 1 });

      await removeArchivedUndatedParagraphsFromTracker(
        wikiApi,
        'TestPage',
        ['\n==Discussion B==\nContent\n'],
      );

      expect(wikiApi.edit).not.toHaveBeenCalled();
      expect(wikiApi.create).not.toHaveBeenCalled();
    });

    it('should append tracker table to non-empty content when tracker page has no table', async () => {
      const trackerContentWithoutTable = 'Some intro text without table';
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: trackerContentWithoutTable, revid: 1 });

      await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      expect(wikiApi.edit).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledWith(
        trackerPageTitle,
        'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך',
        expect.stringContaining('Some intro text without table'),
        1,
      );
    });

    it('should add a paragraph to tracker when existing row has missing title value', async () => {
      const malformedTrackerContent = `{| class="wikitable sortable"
! דף !! כותרת פסקה !! תאריך הוספה
|-
| TestPage || || 2025-02-03
|}`;
      wikiApi.info.mockResolvedValue([{}]);
      wikiApi.articleContent.mockResolvedValue({ content: malformedTrackerContent, revid: 1 });

      const result = await getUndatedParagraphsToArchive(
        wikiApi,
        'TestPage',
        [undatedParagraph],
        { type: 'inactivityDays', inactivityDays: 14 },
      );

      expect(result).toStrictEqual([]);
      expect(wikiApi.edit).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledWith(
        trackerPageTitle,
        'בוט ארכוב: עדכון טבלת פסקאות ללא תאריך',
        expect.stringContaining('Discussion 1'),
        1,
      );
    });
  });
});
