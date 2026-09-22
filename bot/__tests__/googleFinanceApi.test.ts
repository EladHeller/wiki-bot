import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import getStockData, { currencyExchange, getCompanyData, getTickerFromWikiPage } from '../API/googleFinanceApi';
import { WikiPage } from '../types';
import { logger } from '../utilities/logger';

const url = 'https://www.google.com/finance?q=AAPL';
const page = { title: 'Apple', extlinks: [{ '*': url }] } as WikiPage;
const newPage = (value = '4.96T', quote = 'Closed:&nbsp;Sep 22, 4:00:01 PM GMT-4&nbsp; · &nbsp; USD') => `<main>
<div>${quote}</div><div><div>Mkt. cap</div><div>${value}</div></div></main>`;
const oldPage = (value = '4.96T USD', date = 'Sep 22, 4:00:01 PM GMT-4') => `<main>
<div>Closed:<span>${date}</span></div>
<div><div><div>Market cap</div><div>Market capitalization description</div></div><div>${value}</div></div></main>`;

let fetchMock: jest.SpiedFunction<typeof fetch>;

describe('googleFinanceApi', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-22T22:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(newPage()));
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('google Finance responses', () => {
    it('reads the redesigned quote, with currency separated from market cap and a yearless close date', async () => {
      await expect(getStockData(url)).resolves.toStrictEqual({
        marketCap: {
          number: '4.96 [[טריליון]]', currency: 'USD', date: '2026-09-22T20:00:01.000Z',
        },
      });
      expect(fetchMock).toHaveBeenCalledWith(`${url}&hl=en`, expect.objectContaining({
        headers: { 'User-Agent': expect.stringContaining('Mozilla/5.0') }, signal: expect.any(AbortSignal),
      }));
    });

    it('continues to read the old layout and an explicit year', async () => {
      fetchMock.mockResolvedValue(new Response(oldPage('123.45B USD', 'Sep 21, 2026 4:00:00 PM GMT-4')));

      await expect(getStockData(url)).resolves.toStrictEqual({
        marketCap: {
          number: '123.45 [[מיליארד]]', currency: 'USD', date: '2026-09-21T20:00:00.000Z',
        },
      });
    });

    it.each([
      ['25M', '25 [[מיליון]]'], ['3.125K', '3.125 [[1000 (מספר)|אלף]]'],
    ])('accepts market caps in %s format', async (value, expected) => {
      fetchMock.mockResolvedValue(new Response(newPage(value)));

      expect((await getStockData(url))?.marketCap.number).toBe(expected);
    });

    it.each(['—', '0B', '1Q', '1B XYZ', '1.2T trailing', '-1B'])('rejects invalid market caps: %s', async (value) => {
      fetchMock.mockResolvedValue(new Response(newPage(value)));

      await expect(getStockData(url)).resolves.toBeNull();
    });

    it('does not guess USD when a quote currency is missing', async () => {
      fetchMock.mockResolvedValue(new Response(newPage('4.96T', '')));

      await expect(getStockData(url)).resolves.toBeNull();
    });

    it('uses the quote currency for non-USD listings', async () => {
      fetchMock.mockResolvedValue(new Response(newPage('4.96T', 'Sep 22, 8:00:00 PM GMT+1 · GBP')));

      expect((await getStockData(url))?.marketCap.currency).toBe('GBP');
    });

    it('returns null for a missing label without using unrelated numbers', async () => {
      fetchMock.mockResolvedValue(new Response('<main><div>Revenue</div><div>5.00B USD</div></main>'));

      await expect(getStockData(url)).resolves.toBeNull();
    });

    it('rejects a market-cap label directly under main', async () => {
      fetchMock.mockResolvedValue(new Response('<main>Market cap</main>'));

      await expect(getStockData(url)).resolves.toBeNull();
    });

    it('reports unsupported pages instead of silently returning null', async () => {
      fetchMock.mockResolvedValue(new Response('<title>Unsupported</title><div>Your device is not supported</div>'));

      await expect(getStockData(url)).rejects.toThrow('no main element (Unsupported)');
    });

    it('reports non-success HTTP responses', async () => {
      fetchMock.mockResolvedValue(new Response('Too many requests', { status: 429 }));

      await expect(getStockData(url)).rejects.toThrow('Google Finance HTTP 429');
    });

    it('rejects unparseable close dates', async () => {
      fetchMock.mockResolvedValue(new Response(newPage('1B', 'Closed: invalid · USD')));

      await expect(getStockData(url)).rejects.toThrow('invalid close date: invalid');
    });

    it('uses the current date if the market is open', async () => {
      fetchMock.mockResolvedValue(new Response(newPage('1B', 'Sep 22, 12:00:00 PM GMT-4 · USD')));

      expect((await getStockData(url))?.marketCap.date).toBe('2026-09-22T22:00:00.000Z');
    });

    it('handles an empty close timestamp', async () => {
      fetchMock.mockResolvedValue(new Response(oldPage('1B USD', '')));

      expect((await getStockData(url))?.marketCap.date).toBe('2026-09-22T22:00:00.000Z');
    });

    it('assigns the previous year to a December close fetched in January', async () => {
      jest.setSystemTime(new Date('2027-01-01T10:00:00Z'));
      fetchMock.mockResolvedValue(new Response(newPage('1B', 'Closed: Dec 31, 4:00:00 PM GMT-5 · USD')));

      expect((await getStockData(url))?.marketCap.date).toBe('2026-12-31T21:00:00.000Z');
    });
  });

  describe('company lookup', () => {
    it('returns the company data and retains the template ticker', async () => {
      await expect(getCompanyData(page)).resolves.toStrictEqual({
        wiki: page,
        ticker: 'AAPL',
        gf: {
          marketCap: {
            number: '4.96 [[טריליון]]', currency: 'USD', date: '2026-09-22T20:00:01.000Z',
          },
        },
      });
    });

    it('tries all existing fallback URLs when listings return no market cap', async () => {
      [1, 2, 3, 4].forEach(() => {
        fetchMock.mockResolvedValueOnce(new Response('<main>No matching quote</main>'));
      });

      expect((await getCompanyData(page))?.ticker).toBe('AAPL');
      expect(fetchMock.mock.calls.map(([input]) => input)).toStrictEqual([
        `${url}&hl=en`, `${url}%3ANASDAQ&hl=en`, `${url}%3ANYSE&hl=en`,
        'https://www.google.com/finance/quote/AAPL:NASDAQ?hl=en',
        'https://www.google.com/finance/quote/AAPL:NYSE?hl=en',
      ]);
    });

    it('logs exhausted lookups with the page and ticker', async () => {
      fetchMock.mockImplementation(async () => new Response('<main>No matching quote</main>'));
      const warning = jest.spyOn(logger, 'logWarning');

      await expect(getCompanyData(page)).resolves.toBeUndefined();
      expect(warning).toHaveBeenCalledWith('No market cap found for Apple (AAPL)');
    });

    it('logs fetch errors with the affected page', async () => {
      fetchMock.mockRejectedValue(new Error('network failed'));
      const error = jest.spyOn(logger, 'logError');

      await expect(getCompanyData(page)).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Apple: Error: network failed'));
    });

    it.each([{}, { extlinks: [] }, { extlinks: [{ '*': 'https://example.com' }] }])('ignores a page without a matching link: %j', async (data) => {
      await expect(getCompanyData(data as WikiPage)).resolves.toBeUndefined();
      expect(getTickerFromWikiPage(data as WikiPage)).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('extracts qualified tickers', () => {
      expect(getTickerFromWikiPage({ extlinks: [{ '*': `${url}:NASDAQ` }] } as WikiPage)).toBe('AAPL:NASDAQ');
    });
  });

  describe('currency exchange', () => {
    it('reads the previous close', async () => {
      jest.spyOn(JSDOM, 'fromURL').mockResolvedValue(new JSDOM('<main><div role="region"><div><div>1,234.50</div></div></div></main>'));

      await expect(currencyExchange('USD', 'ILS')).resolves.toBe(1234.5);
    });

    it('returns zero without a previous close', async () => {
      jest.spyOn(JSDOM, 'fromURL').mockResolvedValue(new JSDOM('<main></main>'));

      await expect(currencyExchange('USD', 'ILS')).resolves.toBe(0);
    });
  });
});
