import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import type { WikiPageWithGoogleFinance } from '../API/googleFinanceApi';
import type { WikiPage } from '../types';

jest.unstable_mockModule('../API/googleFinanceApi', () => ({
  getCompanyData: jest.fn(), getTickerFromWikiPage: jest.fn(),
}));
jest.unstable_mockModule('../wiki/WikiApi', () => ({ default: jest.fn() }));
jest.unstable_mockModule('../wiki/SharedWikiApiFunctions', () => ({ getGoogleFinanceLinks: jest.fn() }));
jest.unstable_mockModule('../wiki/WikidataSparql', () => ({ companiesWithTicker: jest.fn() }));
jest.unstable_mockModule('../decorators/botLoggerDecorator', () => ({ default: jest.fn((fn) => fn) }));

const { getCompanyData, getTickerFromWikiPage } = await import('../API/googleFinanceApi');
const { getGoogleFinanceLinks } = await import('../wiki/SharedWikiApiFunctions');
const { companiesWithTicker } = await import('../wiki/WikidataSparql');
const { default: WikiApi } = await import('../wiki/WikiApi');
const { default: usMarketValueBot, checkWikidata } = await import('../usMarketValue/index');
const { getTemplateKeyValueData, findTemplate } = await import('../wiki/newTemplateParser');

const template = 'תבנית:שווי שוק חברה בורסאית (ארצות הברית)/נתונים';
const company = (ticker: string, number = '1 [[מיליארד]]'): WikiPageWithGoogleFinance => ({
  ticker,
  wiki: { title: ticker } as WikiPage,
  gf: { marketCap: { number, currency: 'USD', date: '2026-09-22T20:00:00.000Z' } },
});
const apple = company('AAPL');
const microsoft = company('MSFT');
let api: any;
let log: jest.SpiedFunction<typeof console.log>;

describe('usMarketValue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api = {
      login: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined),
      articleContent: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        content: 'before {{#switch: {{{ID}}}| AAPL = old | MSFT = old | timestamp = old | #default = }} after',
        revid: 123,
      }),
      edit: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ edit: { result: 'Success' } }),
      purge: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined),
      info: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([{ lastrevid: 456 }]),
    };
    jest.mocked(WikiApi).mockReturnValue(api);
    jest.mocked(getGoogleFinanceLinks).mockResolvedValue({ a: apple.wiki, m: microsoft.wiki });
    jest.mocked(getCompanyData).mockImplementation(async (page) => company(page.title));
    jest.mocked(companiesWithTicker).mockResolvedValue([]);
    jest.mocked(getTickerFromWikiPage).mockReturnValue(undefined);
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('market cap template updates', () => {
    it('updates sorted company values while preserving surrounding markup and edit conflict protection', async () => {
      jest.mocked(getGoogleFinanceLinks).mockResolvedValue({ m: microsoft.wiki, a: apple.wiki });
      await usMarketValueBot();

      expect(api.edit).toHaveBeenCalledWith(template, 'עדכון', expect.any(String), 123);

      const content = api.edit.mock.calls[0][2];

      expect(content).toMatch(/^before .* after$/s);
      expect(getTemplateKeyValueData(findTemplate(content, '#switch: {{{ID}}}', template))).toStrictEqual({
        AAPL: '1 [[מיליארד]] [[דולר אמריקאי|דולר]]',
        MSFT: '1 [[מיליארד]] [[דולר אמריקאי|דולר]]',
        timestamp: '22 בספטמבר 2026',
        '#default': '',
      });
      expect(content.indexOf('AAPL')).toBeLessThan(content.indexOf('MSFT'));
      expect(api.purge).toHaveBeenCalledWith(['תבנית:שווי שוק חברה בורסאית (ארצות הברית)']);
    });

    it('aborts without reading or editing the template when every lookup fails', async () => {
      jest.mocked(getCompanyData).mockResolvedValue(undefined);

      await expect(usMarketValueBot()).rejects.toThrow('No valid market caps received from Google Finance');
      expect(api.articleContent).not.toHaveBeenCalled();
      expect(api.edit).not.toHaveBeenCalled();
      expect(api.purge).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('Google Finance: checked 2 pages, received 0 market caps');
    });

    it('aborts for an empty source page list', async () => {
      jest.mocked(getGoogleFinanceLinks).mockResolvedValue({});

      await expect(usMarketValueBot()).rejects.toThrow('No valid market caps');
      expect(api.edit).not.toHaveBeenCalled();
    });

    it('aborts when all values are zero', async () => {
      jest.mocked(getCompanyData).mockResolvedValue(company('AAPL', '0'));

      await expect(usMarketValueBot()).rejects.toThrow('No valid market caps');
      expect(api.edit).not.toHaveBeenCalled();
    });

    it('retains the deletion threshold for partially missing data', async () => {
      api.articleContent.mockResolvedValue({
        content: '{{#switch: {{{ID}}}| AAPL = old | MSFT = old | META = old | GOOG = old | timestamp = old | #default = }}',
        revid: 123,
      });
      jest.mocked(getCompanyData).mockResolvedValueOnce(apple).mockResolvedValueOnce(undefined);

      await expect(usMarketValueBot()).rejects.toThrow('Exceeds 20% threshold');
      expect(api.edit).not.toHaveBeenCalled();
    });

    it('rejects missing template content', async () => {
      api.articleContent.mockResolvedValue({ revid: 123 });

      await expect(usMarketValueBot()).rejects.toThrow('Failed to get template content');
      expect(api.edit).not.toHaveBeenCalled();
    });

    it('reports edit errors and does not purge', async () => {
      api.edit.mockResolvedValue({ error: { code: 'editconflict' } });

      await expect(usMarketValueBot()).rejects.toThrow('editconflict');
      expect(api.purge).not.toHaveBeenCalled();
    });

    it('supports data without a date and an unmapped currency', async () => {
      api.articleContent.mockResolvedValue({ content: '{{#switch: {{{ID}}}| AAPL = old }}', revid: 123 });
      jest.mocked(getCompanyData).mockResolvedValue({
        ...apple, gf: { marketCap: { number: '1', currency: 'XXX' as any } },
      });
      await usMarketValueBot();

      expect(api.edit).toHaveBeenCalledWith(template, 'עדכון', expect.stringContaining('1 [[XXX]]'), 123);
    });
  });

  describe('wikidata ticker report', () => {
    it('combines multiple Wikidata listings and template-only companies', async () => {
      jest.mocked(companiesWithTicker).mockResolvedValue([
        {
          companyLabel: 'Apple', exchangeShortName: 'NASDAQ', articleName: 'AAPL', ticker: 'AAPL', exchangeLabel: 'NASDAQ', companyId: 'Q1',
        },
        {
          companyLabel: 'Apple', exchangeShortName: 'FRA', articleName: 'AAPL', ticker: 'APC', exchangeLabel: 'Frankfurt', companyId: 'Q1',
        },
        {
          companyLabel: 'Only Wikidata', exchangeShortName: 'NYSE', articleName: 'Only Wikidata', ticker: 'WD', exchangeLabel: 'NYSE', companyId: 'Q2',
        },
      ]);
      jest.mocked(getTickerFromWikiPage).mockImplementation((page) => page.title);
      await checkWikidata();

      expect(api.edit).toHaveBeenCalledWith('user:Test-bot/מניות ארצות הברית', 'עדכון', expect.any(String), 456);

      const content = api.edit.mock.calls[0][2];

      expect(content).toContain('NASDAQ:AAPL{{ש}}Frankfurt:APC');
      expect(content).toContain('[[:d:Q1|Q1]]');
      expect(content).toContain('[[MSFT]]');
      expect(content).toContain('[[Only Wikidata]]');
    });

    it('ignores pages without tickers and reports a missing revision', async () => {
      api.info.mockResolvedValue([{}]);

      await expect(checkWikidata()).rejects.toThrow('Failed to get revid');
      expect(api.edit).not.toHaveBeenCalled();
    });
  });
});
