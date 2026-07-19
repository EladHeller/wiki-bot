import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import { clearIABotCache, lookupIABotLinks } from '../tag-bot/actions/internetArchiveBot';

describe('internetArchiveBot', () => {
  const fetchMock = jest.fn<typeof fetch>();
  let now: number;

  beforeEach(() => {
    jest.clearAllMocks();
    clearIABotCache();
    now = Date.parse('2026-07-19T00:00:00Z');
  });

  it('should batch URLs and map fresh IABot states', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      urls: {
        1: {
          url: 'https://example.com/alive',
          accesstime: '2026-07-18 12:00:00',
          live_state: 'alive',
        },
        2: {
          url: 'https://example.com/dead',
          accesstime: '2026-07-17 12:00:00',
          live_state: 'dead',
        },
      },
    }), { status: 200 }));

    const result = await lookupIABotLinks([
      'https://example.com/alive',
      'https://example.com/dead',
    ], { fetchFn: fetchMock, now: () => now });

    expect(result.get('https://example.com/alive')).toBe('alive');
    expect(result.get('https://example.com/dead')).toBe('dead');

    const request = fetchMock.mock.calls[0][1];

    expect(request?.method).toBe('POST');
    expect((request?.body as URLSearchParams).get('urls')).toBe('https://example.com/alive\nhttps://example.com/dead');
  });

  it('should trust permanent domain states without a recent access time', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      urls: {
        1: { normalizedurl: 'https://example.com/', live_state: 'whitelisted' },
      },
    }), { status: 200 }));

    const result = await lookupIABotLinks(['https://example.com'], {
      fetchFn: fetchMock, now: () => now,
    });

    expect(result.get('https://example.com')).toBe('alive');
  });

  it('should ignore stale non-permanent results', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      urls: {
        1: {
          url: 'https://example.com',
          accesstime: '2025-01-01 00:00:00',
          live_state: 'alive',
        },
      },
    }), { status: 200 }));

    const result = await lookupIABotLinks(['https://example.com'], {
      fetchFn: fetchMock, now: () => now,
    });

    expect(result.get('https://example.com')).toBe('unknown');
  });

  it('should map fresh non-final IABot states', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      urls: {
        1: { url: 'https://example.com/dying', accesstime: '2026-07-18 12:00:00', live_state: 'dying' },
        2: { url: 'https://example.com/paywall', accesstime: '2026-07-18 12:00:00', live_state: 'paywall' },
        3: { url: 'https://example.com/other', accesstime: '2026-07-18 12:00:00', live_state: 'other' },
      },
    }), { status: 200 }));

    const result = await lookupIABotLinks([
      'https://example.com/dying',
      'https://example.com/paywall',
      'https://example.com/other',
    ], { fetchFn: fetchMock, now: () => now });

    expect(result.get('https://example.com/dying')).toBe('transient');
    expect(result.get('https://example.com/paywall')).toBe('blocked');
    expect(result.get('https://example.com/other')).toBe('unknown');
  });

  it('should ignore records without access times or with invalid access times', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      urls: {
        1: { url: 'https://example.com/missing', live_state: 'alive' },
        2: { url: 'https://example.com/invalid', accesstime: 'not-a-date', live_state: 'alive' },
      },
    }), { status: 200 }));

    const result = await lookupIABotLinks([
      'https://example.com/missing',
      'https://example.com/invalid',
    ], { fetchFn: fetchMock, now: () => now });

    expect(result.get('https://example.com/missing')).toBe('unknown');
    expect(result.get('https://example.com/invalid')).toBe('unknown');
  });

  it('should map blacklisted domains as dead', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      urls: { 1: { url: 'https://example.com', live_state: 'blacklisted' } },
    }), { status: 200 }));

    const result = await lookupIABotLinks(['https://example.com'], {
      fetchFn: fetchMock, now: () => now,
    });

    expect(result.get('https://example.com')).toBe('dead');
  });

  it('should return unknown for URLs IABot has not encountered', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ urls: {} }), { status: 200 }));

    const result = await lookupIABotLinks(['https://unknown.example'], {
      fetchFn: fetchMock, now: () => now,
    });

    expect(result.get('https://unknown.example')).toBe('unknown');
  });

  it('should handle invalid URLs and responses without a urls property', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    const result = await lookupIABotLinks(['not a URL'], {
      fetchFn: fetchMock, now: () => now,
    });

    expect(result.get('not a URL')).toBe('unknown');
  });

  it('should reuse cached results', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      urls: { 1: { url: 'https://example.com', live_state: 'whitelisted' } },
    }), { status: 200 }));
    const dependencies = { fetchFn: fetchMock, now: () => now };

    await lookupIABotLinks(['https://example.com'], dependencies);
    await lookupIABotLinks(['https://example.com/'], dependencies);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should refresh expired cached results', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      urls: { 1: { url: 'https://example.com', live_state: 'whitelisted' } },
    }), { status: 200 }));
    const dependencies = { fetchFn: fetchMock, now: () => now };

    await lookupIABotLinks(['https://example.com'], dependencies);
    now += 2 * 60 * 60 * 1000;
    await lookupIABotLinks(['https://example.com'], dependencies);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should support an empty lookup with default dependencies', async () => {
    await expect(lookupIABotLinks([])).resolves.toStrictEqual(new Map());
  });

  it('should throw when IABot returns an error response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429, statusText: 'Too Many Requests' }));

    await expect(lookupIABotLinks(['https://example.com'], {
      fetchFn: fetchMock, now: () => now,
    })).rejects.toThrow('IABot returned 429 Too Many Requests');
  });

  it('should cancel error response bodies before throwing', async () => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429, statusText: 'Too Many Requests' }));

    await expect(lookupIABotLinks(['https://example.com'], {
      fetchFn: fetchMock, now: () => now,
    })).rejects.toThrow('IABot returned 429 Too Many Requests');
  });
});
