import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import ExchangeRatesModel from '../exchangeRates/ExchangeRatesModel';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('exchangeRatesModel', () => {
  const mockWikiApi = WikiApiMock();
  const mockDataFetcher = jest.fn<(url: string) => Promise<any>>();
  const mockConfig = {
    apiBaseUrl: 'https://api.frankfurter.app',
    templatePage: 'תבנית:שערי חליפין (יורו)/נתונים',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchRates', () => {
    it('should fetch and return exchange rates data', async () => {
      const mockData = {
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
        rates: {
          USD: 1.1776,
          ILS: 3.7958,
          GBP: 0.8764,
        },
      };

      mockDataFetcher.mockResolvedValueOnce(mockData);

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);
      const result = await model.fetchRates();

      expect(result).toStrictEqual(mockData);
      expect(mockDataFetcher).toHaveBeenCalledWith(`${mockConfig.apiBaseUrl}/latest`);
    });

    it('should throw error when API returns invalid data', async () => {
      mockDataFetcher.mockResolvedValueOnce({});

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.fetchRates()).rejects.toThrow('Invalid data received from API');
    });

    it('should throw error when base currency is not EUR', async () => {
      mockDataFetcher.mockResolvedValueOnce({
        amount: 1,
        base: 'USD',
        date: '2025-12-16',
        rates: { EUR: 0.85 },
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.fetchRates()).rejects.toThrow('Expected EUR as base currency');
    });

    it('should throw error when rates are missing', async () => {
      mockDataFetcher.mockResolvedValueOnce({
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.fetchRates()).rejects.toThrow('Invalid data received from API');
    });

    it('should throw error when date is missing', async () => {
      mockDataFetcher.mockResolvedValueOnce({
        amount: 1,
        base: 'EUR',
        rates: { USD: 1.1776 },
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.fetchRates()).rejects.toThrow('Invalid data received from API');
    });
  });

  describe('updateRatesTemplate', () => {
    it('should update template with new rates', async () => {
      const mockData = {
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
        rates: {
          USD: 1.1776,
          ILS: 3.7958,
          GBP: 0.8764,
        },
      };

      const mockContent = `{{#switch: {{{1}}}
|USD=1.1500
|ILS=3.7000
|GBP=0.8500
|date=15 בדצמבר 2025
|#default=
}}`;

      mockDataFetcher.mockResolvedValueOnce(mockData);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockContent,
        revid: 123,
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);
      await model.updateRatesTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledTimes(1);
      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        mockConfig.templatePage,
        'עדכון שערי חליפין',
        expect.stringContaining('USD=1.1776'),
        123,
      );
      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        mockConfig.templatePage,
        'עדכון שערי חליפין',
        expect.stringContaining('ILS=3.7958'),
        123,
      );
      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        mockConfig.templatePage,
        'עדכון שערי חליפין',
        expect.stringContaining('date=16 בדצמבר 2025'),
        123,
      );
    });

    it('should not update when content is identical', async () => {
      const mockData = {
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
        rates: {
          USD: 1.1776,
          ILS: 3.7958,
        },
      };

      const mockContent = `{{#switch: {{{1}}}
|USD=1.1776
|ILS=3.7958
|date=16 בדצמבר 2025
|#default=
}}`;

      mockDataFetcher.mockResolvedValueOnce(mockData);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockContent,
        revid: 123,
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);
      await model.updateRatesTemplate();

      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      const mockData = {
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
        rates: { USD: 1.1776 },
      };

      mockDataFetcher.mockResolvedValueOnce(mockData);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: 'No template here',
        revid: 123,
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.updateRatesTemplate()).rejects.toThrow('Template not found');
    });

    it('should throw error when content is missing', async () => {
      const mockData = {
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
        rates: { USD: 1.1776 },
      };

      mockDataFetcher.mockResolvedValueOnce(mockData);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: '',
        revid: 123,
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.updateRatesTemplate()).rejects.toThrow('Missing content for תבנית:שערי חליפין (יורו)/נתונים');
    });

    it('should throw error when revid is missing', async () => {
      const mockData = {
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
        rates: { USD: 1.1776 },
      };

      mockDataFetcher.mockResolvedValueOnce(mockData);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: 'some content',
        revid: Number.NaN,
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.updateRatesTemplate()).rejects.toThrow('Missing revid for תבנית:שערי חליפין (יורו)/נתונים');
    });

    it('should handle API errors', async () => {
      mockDataFetcher.mockRejectedValueOnce(new Error('API Error'));

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);

      await expect(model.updateRatesTemplate()).rejects.toThrow('API Error');
    });

    it('should handle all currencies from API', async () => {
      const mockData = {
        amount: 1,
        base: 'EUR',
        date: '2025-12-16',
        rates: {
          AUD: 1.7737,
          BGN: 1.9558,
          BRL: 6.3965,
          CAD: 1.6206,
          CHF: 0.9351,
          CNY: 8.293,
          CZK: 24.317,
          DKK: 7.471,
          GBP: 0.8764,
          HKD: 9.1609,
          HUF: 384.3,
          IDR: 19625,
          ILS: 3.7958,
          INR: 107.07,
          ISK: 148.0,
          JPY: 182.07,
          KRW: 1734.89,
          MXN: 21.153,
          MYR: 4.8111,
          NOK: 11.985,
          NZD: 2.0346,
          PHP: 69.049,
          PLN: 4.2208,
          RON: 5.0929,
          SEK: 10.942,
          SGD: 1.5176,
          THB: 37.071,
          TRY: 50.301,
          USD: 1.1776,
          ZAR: 19.7365,
        },
      };

      const mockContent = `{{#switch: {{{1}}}
|USD=1.0
|#default=
}}`;

      mockDataFetcher.mockResolvedValueOnce(mockData);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockContent,
        revid: 123,
      });

      const model = ExchangeRatesModel(mockWikiApi, mockConfig, mockDataFetcher);
      await model.updateRatesTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledTimes(1);

      const editCall = mockWikiApi.edit.mock.calls[0];
      const newContent = editCall[2] as string;

      // Verify all currencies are included
      expect(newContent).toContain('TRY=50.301');
      expect(newContent).toContain('USD=1.1776');
      expect(newContent).toContain('ILS=3.7958');
      expect(newContent).toContain('date=16 בדצמבר 2025');
    });
  });
});
