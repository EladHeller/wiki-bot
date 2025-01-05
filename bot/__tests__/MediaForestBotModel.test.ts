import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import MediaForestBotModel from '../mediaforest/MediaForestModel';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('mediaForestBotModel', () => {
  const mockWikiApi = WikiApiMock();

  const mockDataFetcher = jest.fn<(url: any) => Promise<any>>();
  const mockConfig = {
    baseUrl: 'https://test.com/',
    page: 'TestPage',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMediaForestData', () => {
    it('should fetch and return chart data when there are changes', async () => {
      mockDataFetcher
        .mockResolvedValueOnce(['10 10.11 17.11']) // weeks response
        .mockResolvedValueOnce({ // chart response
          entries: [
            { title: 'Song1', artist: 'Artist1', thisweek: '1' },
            { title: 'Song2', artist: 'Artist2', thisweek: '2' },
          ],
        });

      mockWikiApi.articleContent.mockResolvedValue({
        content: 'old content',
        revid: 123,
      });

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);
      const result = await model.getMediaForestData();

      expect(result).toStrictEqual({
        entries: [
          { title: 'Song1', artist: 'Artist1', position: '1' },
          { title: 'Song2', artist: 'Artist2', position: '2' },
        ],

        week: '10.11-17.11',
      });
      expect(mockWikiApi.edit).toHaveBeenCalledTimes(1);
      expect(mockWikiApi.edit).toHaveBeenCalledWith(`${mockConfig.page}/שבוע אחרון`, 'עדכון מדיה פורסט', '10 10.11 17.11', 123);
    });

    it('should return empty array when no changes', async () => {
      mockDataFetcher.mockResolvedValueOnce(['2024 10-11 17-11']);
      mockWikiApi.articleContent.mockResolvedValue({
        content: '2024 10-11 17-11',
        revid: 123,
      });

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);
      const result = await model.getMediaForestData();

      expect(result).toStrictEqual({
        entries: [],
        week: '10.11-17.11',
      });
      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });
  });

  describe('getOldData', () => {
    it('should fetch and save data for a single year', async () => {
      const mockWeeks = ['10 3-5', '11 10-5'];
      const mockChart = {
        entries: [
          { title: 'Song1', artist: 'Artist1', thisweek: '1' },
          { title: 'Song2', artist: 'Artist2', thisweek: '2' },
        ],
      };

      mockDataFetcher
        .mockResolvedValueOnce(mockWeeks)
        .mockResolvedValueOnce(mockChart)
        .mockResolvedValueOnce(mockChart);

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);
      const result = await model.getOldData(2023, 2023);

      expect(result).toHaveLength(2);
      expect(mockDataFetcher).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple years', async () => {
      mockDataFetcher
        .mockResolvedValueOnce(['2022-W52'])
        .mockResolvedValueOnce({ entries: [] })
        .mockResolvedValueOnce(['2023-W01'])
        .mockResolvedValueOnce({ entries: [] });

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);
      const result = await model.getOldData(2022, 2023);

      expect(result).toHaveLength(2);
      expect(mockDataFetcher).toHaveBeenCalledTimes(4);
    });

    it('should throw error when no weeks found', async () => {
      mockDataFetcher.mockResolvedValueOnce([]);

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.getOldData(2023, 2023)).rejects.toThrow('No data found');
    });

    it('should handle API errors', async () => {
      mockDataFetcher.mockRejectedValueOnce(new Error('API Error'));

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.getOldData(2023, 2023)).rejects.toThrow('API Error');
    });
  });

  describe('updateChartTable', () => {
    it('should update table with new data', async () => {
      const mockContent = '{| class="wikitable"\n! שבוע !! 1 !! 2\n|-\n| old data || song1 || song2\n|}';

      mockWikiApi.articleContent.mockResolvedValue({
        content: mockContent,
        revid: 123,
      });

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);
      const data = [
        { title: 'New Song1', artist: 'Artist1', position: '1' },
        { title: 'New Song2', artist: 'Artist2', position: '2' },
      ];

      await model.updateChartTable([{
        entries: data,
        week: '5.1.25-11.1.25',
      }]);

      expect(mockWikiApi.edit).toHaveBeenCalledTimes(1);
      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        mockConfig.page,
        'עדכון מדיה פורסט',
        '{| class="wikitable"\n! שבוע !! 1 !! 2\n|-\n|old data || song1 || song2\n|-\n|5.1.25-11.1.25 || "New Song1" - (Artist1) || "New Song2" - (Artist2)\n|}',
        123,
      );
    });

    it('should throw error when table not found', async () => {
      mockWikiApi.articleContent.mockResolvedValue({
        content: 'No table here',
        revid: 123,
      });

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);
      const data = [
        { title: 'Song1', artist: 'Artist1', position: '1' },
      ];

      await expect(model.updateChartTable([{
        entries: data,
        week: '5.1.25-11.1.25',
      }])).rejects.toThrow('Table not found');
    });
  });

  describe('error handling', () => {
    it('should throw error when weeks API fails', async () => {
      mockDataFetcher.mockRejectedValue(new Error('API Error'));

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.getMediaForestData()).rejects.toThrow('API Error');
    });

    it('should throw error when no weeks data found', async () => {
      mockDataFetcher.mockResolvedValue([]);

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.getMediaForestData()).rejects.toThrow('No data found');
    });

    it('throw error on missing wiki content', async () => {
      mockWikiApi.articleContent.mockResolvedValue(null);

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.updateChartTable([])).rejects.toThrow('Missing content for TestPage');
    });

    it('throw error on empty wiki content', async () => {
      mockWikiApi.articleContent.mockResolvedValue({ content: '', revid: 123 });

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.updateChartTable([])).rejects.toThrow('Missing content for TestPage');
    });

    it('throw error on missing wiki revid', async () => {
      mockWikiApi.articleContent.mockResolvedValue({ content: 'content', revid: Number.NaN });

      const model = MediaForestBotModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.updateChartTable([])).rejects.toThrow('Missing revid for TestPage');
    });
  });
});
