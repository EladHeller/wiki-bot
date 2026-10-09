import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import {
  checkLinksWithHttp, classifyLinkStatus, clearLinkCheckCache,
} from '../tag-bot/actions/externalLinkChecker';
import { getUserAgent } from '../utilities';

const links = [{ link: 'https://example.com/page', text: 'Page' }];

describe('externalLinkChecker', () => {
  const fetchMock = jest.fn<typeof fetch>();
  const sleepMock = jest.fn<(milliseconds: number) => Promise<void>>();
  let now: number;

  beforeEach(() => {
    jest.clearAllMocks();
    clearLinkCheckCache();
    now = Date.now();
    sleepMock.mockResolvedValue(undefined);
    process.env.BOT_NAME = 'Sapper-bot';
    process.env.BASE_URL = 'https://he.wikipedia.org';
  });

  it('should send an honest bot user agent and Wikipedia referrer', async () => {
    fetchMock.mockResolvedValue(new Response('OK', { status: 200 }));

    const result = await checkLinksWithHttp(links, 'ערך לדוגמה', {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/page', expect.objectContaining({
      redirect: 'follow',
      headers: expect.objectContaining({
        'User-Agent': 'Sapper-bot/1.0 (https://he.wikipedia.org/wiki/User:Sapper-bot)',
        Referer: 'https://he.wikipedia.org/wiki/%D7%A2%D7%A8%D7%9A_%D7%9C%D7%93%D7%95%D7%92%D7%9E%D7%94',
        Accept: expect.any(String),
        'Accept-Language': expect.any(String),
      }),
    }));
    expect(result.get(links[0].link)?.state).toBe('alive');
    expect(getUserAgent()).toContain('Sapper-bot/1.0');
  });

  describe('wayback snapshots', () => {
    const timestamp = '20120401201535';
    const original = 'https://grrm.livejournal.com/3797.html?view=all';
    const waybackLink = { link: `https://web.archive.org/web/${timestamp}/${original}#comments`, text: 'Archived post' };
    const cdxRows = [['timestamp', 'statuscode'], [timestamp, '200']];
    const dependencies = { fetchFn: fetchMock, sleep: sleepMock, now: () => now };
    const jsonResponse = (data: unknown) => new Response(JSON.stringify(data), { status: 200, statusText: 'OK' });
    const available = (captureTimestamp: string = timestamp, status: string = '200') => ({
      archived_snapshots: { closest: { available: true, timestamp: captureTimestamp, status } },
    });

    it('should accept only a successful snapshot at the requested timestamp', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(available()));
      const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

      const result = await checkLinksWithHttp([waybackLink], 'Page', dependencies);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);

      expect(requestUrl.origin + requestUrl.pathname).toBe('https://archive.org/wayback/available');
      expect(Object.fromEntries(requestUrl.searchParams)).toStrictEqual({ url: original, timestamp, timeout: '20' });
      expect(timeoutSpy).toHaveBeenCalledWith(25000);

      timeoutSpy.mockRestore();

      expect(result.get(waybackLink.link)).toStrictEqual({ state: 'alive', status: 200, statusText: 'OK' });
    });

    it.each([
      ['empty search', { archived_snapshots: {} }],
      ['missing fields', {}],
      ['null response', null],
      ['unavailable capture', { archived_snapshots: { closest: { available: false } } }],
      ['different timestamp', available('20260827171906')],
      ['missing timestamp', { archived_snapshots: { closest: { available: true, status: '200' } } }],
      ['invalid timestamp', available('2012')],
      ['missing status', { archived_snapshots: { closest: { available: true, timestamp } } }],
      ['error capture', available(timestamp, '404')],
      ['redirect capture', available(timestamp, '301')],
      ['invalid status', available(timestamp, '0')],
    ])('should consult exact CDX records after %s', async (_name, response) => {
      fetchMock.mockResolvedValueOnce(jsonResponse(response)).mockResolvedValueOnce(jsonResponse(cdxRows));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(fetchMock).toHaveBeenCalledTimes(2);

      const requestUrl = new URL(fetchMock.mock.calls[1][0] as string);

      expect(requestUrl.origin + requestUrl.pathname).toBe('https://web.archive.org/cdx/search/cdx');
      expect(Object.fromEntries(requestUrl.searchParams)).toStrictEqual({
        url: original,
        output: 'json',
        fl: 'timestamp,statuscode',
        from: timestamp,
        to: timestamp,
        filter: 'statuscode:2[0-9][0-9]',
        limit: '1',
      });
      expect(result.get(waybackLink.link)).toStrictEqual({ state: 'alive' });
      expect(fetchMock.mock.calls.some(([url]) => url === waybackLink.link)).toBe(false);
    });

    it.each([[], [['timestamp', 'statuscode']], null, {}, [['wrong header'], [timestamp, '200']],
      [['timestamp', 'statuscode'], null], [['timestamp', 'statuscode'], ['20260827171906', '200']],
      [['timestamp', 'statuscode'], [timestamp, '404']], [['timestamp', 'statuscode'], [timestamp, '302']],
    ].map((response) => [response]))('should leave absent or inconclusive CDX records unverified (%j)', async (cdxResponse) => {
      fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse(cdxResponse));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)).toStrictEqual({ state: 'unknown' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([403, 404, 410, 429, 503])('should use CDX after availability endpoint HTTP %s', async (status) => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(jsonResponse(cdxRows));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)?.state).toBe('alive');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([404, 410, 503])('should treat CDX HTTP %s as a service failure, not a broken snapshot', async (status) => {
      fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(new Response(null, { status }));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)).toStrictEqual(expect.objectContaining({ state: 'transient', status }));
    });

    it.each([403, 429])('should preserve CDX blocking status %s', async (status) => {
      fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(new Response(null, { status }));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)).toStrictEqual(expect.objectContaining({ state: 'blocked', status }));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should use CDX after an availability timeout', async () => {
      fetchMock.mockRejectedValueOnce(new Error('availability timeout')).mockResolvedValueOnce(jsonResponse(cdxRows));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)?.state).toBe('alive');
    });

    it('should handle invalid JSON from either archive API without reporting a broken snapshot', async () => {
      fetchMock.mockResolvedValueOnce(new Response('not JSON')).mockResolvedValueOnce(new Response('not JSON'));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)?.state).toBe('transient');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should keep a CDX timeout unresolved', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({})).mockRejectedValueOnce(new Error('CDX timeout'));

      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)).toStrictEqual({ state: 'transient', error: 'CDX timeout' });
    });

    it('should cache successful archive checks', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(available()));

      await checkLinksWithHttp([waybackLink], undefined, dependencies);
      now += 61000;
      await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should refresh inconclusive archive results after one minute', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse(available()));

      await checkLinksWithHttp([waybackLink], undefined, dependencies);
      await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(fetchMock).toHaveBeenCalledTimes(2);

      now += 61000;
      const result = await checkLinksWithHttp([waybackLink], undefined, dependencies);

      expect(result.get(waybackLink.link)?.state).toBe('alive');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should support partial timestamps and replay modifiers through availability', async () => {
      const link = { link: `http://web.archive.org/web/201204id_/${original}`, text: 'Archived page' };
      fetchMock.mockResolvedValueOnce(jsonResponse(available()));

      const result = await checkLinksWithHttp([link], undefined, dependencies);

      expect(result.get(link.link)?.state).toBe('alive');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should support partial timestamps and replay modifiers through CDX', async () => {
      const link = { link: `http://web.archive.org/web/201204id_/${original}`, text: 'Archived page' };
      fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse(cdxRows));

      const result = await checkLinksWithHttp([link], undefined, dependencies);

      expect(result.get(link.link)?.state).toBe('alive');

      const cdxUrl = new URL(fetchMock.mock.calls[1][0] as string);

      expect(cdxUrl.searchParams.get('from')).toBe('201204');
      expect(cdxUrl.searchParams.get('to')).toBe('201204');
    });
  });

  it('should retry and confirm 404 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }));

    const result = await checkLinksWithHttp(links, undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledWith(expect.any(Number));
    expect(result.get(links[0].link)).toStrictEqual(expect.objectContaining({
      state: 'dead', status: 404, statusText: 'Not Found',
    }));
  });

  it('should honor numeric, invalid, and dated Retry-After values', async () => {
    const dateNow = Date.now();
    const dateNowMock = jest.spyOn(Date, 'now').mockReturnValue(dateNow);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404, headers: { 'Retry-After': 'invalid' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, {
        status: 404,
        headers: { 'Retry-After': new Date(dateNow + 3000).toISOString() },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await checkLinksWithHttp([
      { link: 'https://one.example/page', text: 'One' },
      { link: 'https://two.example/page', text: 'Two' },
      { link: 'https://three.example/page', text: 'Three' },
    ], undefined, { fetchFn: fetchMock, sleep: sleepMock, now: () => now });

    dateNowMock.mockRestore();

    expect(sleepMock).toHaveBeenCalledWith(2000);
    expect(sleepMock).toHaveBeenCalledWith(1000);
    expect(sleepMock).toHaveBeenCalledWith(3000);
  });

  it('should classify 403 as blocked without retrying', async () => {
    fetchMock.mockResolvedValue(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));

    const result = await checkLinksWithHttp(links, undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get(links[0].link)?.state).toBe('blocked');
  });

  it('should identify a Cloudflare challenge returned as 503', async () => {
    fetchMock.mockResolvedValue(new Response('<title>Just a moment...</title>', {
      status: 503,
      headers: { server: 'cloudflare' },
    }));

    const result = await checkLinksWithHttp(links, undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.get(links[0].link)?.state).toBe('blocked');
  });

  it('should detect challenge headers and Cloudflare 403 responses', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 503, headers: { 'cf-mitigated': 'challenge' } }))
      .mockResolvedValueOnce(new Response('', { status: 403, headers: { server: 'cloudflare' } }));

    const result = await checkLinksWithHttp([
      { link: 'https://one.example/page', text: 'One' },
      { link: 'https://two.example/page', text: 'Two' },
    ], undefined, { fetchFn: fetchMock, sleep: sleepMock, now: () => now });

    expect(result.get('https://one.example/page')?.state).toBe('blocked');
    expect(result.get('https://two.example/page')?.state).toBe('blocked');
  });

  it('should handle challenge responses without a body', async () => {
    const response = {
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers(),
      body: null,
    } as Response;
    fetchMock.mockResolvedValue(response);

    const result = await checkLinksWithHttp(links, undefined, {
      fetchFn: fetchMock, sleep: sleepMock, now: () => now,
    });

    expect(result.get(links[0].link)?.state).toBe('blocked');
  });

  it('should retry transient request errors and preserve the final error', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));

    const result = await checkLinksWithHttp(links, undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get(links[0].link)).toStrictEqual({ state: 'transient', error: 'timeout' });
  });

  it('should preserve non-Error request failures', async () => {
    fetchMock.mockRejectedValue('network unavailable');

    const result = await checkLinksWithHttp(links, undefined, {
      fetchFn: fetchMock, sleep: sleepMock, now: () => now,
    });

    expect(result.get(links[0].link)).toStrictEqual({ state: 'transient', error: 'network unavailable' });
  });

  it('should classify uncommon response statuses', () => {
    expect(classifyLinkStatus(410)).toBe('dead');
    expect(classifyLinkStatus(401)).toBe('blocked');
    expect(classifyLinkStatus(408)).toBe('transient');
    expect(classifyLinkStatus(418)).toBe('unknown');
  });

  it('should reuse cached URL results', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const dependencies = { fetchFn: fetchMock, sleep: sleepMock, now: () => now };

    await checkLinksWithHttp(links, undefined, dependencies);
    await checkLinksWithHttp(links, undefined, dependencies);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should refresh expired cached results', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const dependencies = { fetchFn: fetchMock, sleep: sleepMock, now: () => now };

    await checkLinksWithHttp(links, undefined, dependencies);
    now += 11 * 60 * 1000;
    await checkLinksWithHttp(links, undefined, dependencies);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should support an empty check with default dependencies', async () => {
    await expect(checkLinksWithHttp([])).resolves.toStrictEqual(new Map());
  });

  it('should pace different URLs on the same host', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await checkLinksWithHttp([
      ...links,
      { link: 'https://example.com/other', text: 'Other' },
    ], undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(sleepMock).toHaveBeenCalledWith(1000);
  });
});
