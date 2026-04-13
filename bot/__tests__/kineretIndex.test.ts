import {
  describe, expect, it, jest, beforeEach, afterEach,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

const mockKineretModel = {
  fetchLevelData: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  updateWikiTemplate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  updateWikiData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

const mockDeadSeaModel = {
  fetchLevelData: jest.fn<() => Promise<any>>().mockResolvedValue({}),
  updateWikiTemplate: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  updateWikiData: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

const wikiApiMock = WikiApiMock();
const fetchUrlLikeBrowserMock: any = jest.fn();

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: jest.fn(() => wikiApiMock),
}));

jest.unstable_mockModule('../wiki/WikidataAPI', () => ({
  default: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../kineret/KineretModel', () => ({
  default: jest.fn(() => mockKineretModel),
}));

jest.unstable_mockModule('../kineret/DeadSeaModel', () => ({
  default: jest.fn(() => mockDeadSeaModel),
}));

jest.unstable_mockModule('../utilities', () => ({
  fetchUrlLikeBrowser: (url: string) => fetchUrlLikeBrowserMock(url),
  getLocalTimeAndDate: (dateString: string) => dateString,
}));

const {
  default: kineretBot,
  defaultDataFetcher,
  getCurrentDate,
  kineretDataFetcher,
} = await import('../kineret/index');

describe('kineretBot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call kineret model methods', async () => {
    await kineretBot();

    expect(wikiApiMock.login).toHaveBeenCalledWith();
    expect(mockKineretModel.fetchLevelData).toHaveBeenCalledWith();
    expect(mockKineretModel.updateWikiTemplate).toHaveBeenCalledWith();
    expect(mockKineretModel.updateWikiData).toHaveBeenCalledWith();
  });

  it('should call dead sea model methods', async () => {
    await kineretBot();

    expect(mockDeadSeaModel.fetchLevelData).toHaveBeenCalledWith();
    expect(mockDeadSeaModel.updateWikiTemplate).toHaveBeenCalledWith();
    expect(mockDeadSeaModel.updateWikiData).toHaveBeenCalledWith();
  });

  describe('defaultDataFetcher', () => {
    it('should fetch data successfully', async () => {
      const mockResponse = { data: 'test' };
      const spy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn<() => Promise<any>>().mockResolvedValue(mockResponse),
      } as any);

      const result = await defaultDataFetcher('https://example.com');

      expect(spy).toHaveBeenCalledWith('https://example.com');

      expect(result).toStrictEqual(mockResponse);
    });

    it('should throw error on fetch failure', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
      } as Response);

      await expect(defaultDataFetcher('https://example.com')).rejects.toThrow('Failed to fetch data from https://example.com');
    });
  });

  describe('getCurrentDate', () => {
    it('should return a date object', () => {
      const result = getCurrentDate();

      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('kineretDataFetcher', () => {
    it('should parse level and date from html', async () => {
      fetchUrlLikeBrowserMock.mockResolvedValue({
        text: async () => `
          <div class="hp_miflas_height">-209.55</div>
          <div class="hp_miflas_date">13/04/2026</div>
        `,
      });

      const result = await kineretDataFetcher('https://kineret.org.il/');

      expect(fetchUrlLikeBrowserMock).toHaveBeenCalledWith('https://kineret.org.il/');
      expect(result).toStrictEqual({
        result: {
          records: [
            {
              Survey_Date: '13/04/2026',
              Kinneret_Level: -209.55,
              _id: 0,
            },
          ],
        },
      });
    });

    it('should throw when missing level or date', async () => {
      fetchUrlLikeBrowserMock.mockResolvedValue({
        text: async () => `
          <div class="hp_miflas_height"></div>
          <div class="hp_miflas_date">no-date</div>
        `,
      });

      await expect(kineretDataFetcher('https://kineret.org.il/'))
        .rejects
        .toThrow('Failed to parse level or date');
    });
  });
});
