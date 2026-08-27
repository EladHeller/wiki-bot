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

  it('should verify Wayback links through the availability API', async () => {
    const waybackLink = {
      link: 'https://web.archive.org/web/20120401201535/https://grrm.livejournal.com/3797.html?view=all#comments',
      text: 'Archived post',
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      archived_snapshots: {
        closest: { available: true, status: '200' },
      },
    }), { status: 200, statusText: 'OK' }));

    const result = await checkLinksWithHttp([waybackLink], undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://archive.org/wayback/available?url=https%3A%2F%2Fgrrm.livejournal.com%2F3797.html%3Fview%3Dall&timestamp=20120401201535',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );
    expect(result.get(waybackLink.link)).toStrictEqual({ state: 'alive', status: 200, statusText: 'OK' });
  });

  it('should accept an available Wayback snapshot without a reported status', async () => {
    const waybackLink = {
      link: 'https://web.archive.org/web/20120401201535/http://example.com/page',
      text: 'Archived page',
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      archived_snapshots: { closest: { available: true } },
    }), { status: 200 }));

    const result = await checkLinksWithHttp([waybackLink], undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(result.get(waybackLink.link)?.state).toBe('alive');
    expect(result.get(waybackLink.link)?.status).toBe(200);
  });

  it('should retry and report unavailable Wayback snapshots as dead', async () => {
    const waybackLink = {
      link: 'http://web.archive.org/web/20060101id_/http://example.com/missing',
      text: 'Missing snapshot',
    };
    fetchMock.mockImplementation(async () => new Response(
      JSON.stringify({ archived_snapshots: {} }),
      { status: 200 },
    ));

    const result = await checkLinksWithHttp([waybackLink], undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get(waybackLink.link)).toStrictEqual({
      state: 'dead', status: 404, statusText: 'שמירה לא נמצאה בארכיון',
    });
  });

  it('should fall back to the regular flow when the availability API fails', async () => {
    const waybackLink = {
      link: 'https://web.archive.org/web/20120401201535/http://example.com/page',
      text: 'Archived page',
    };
    fetchMock.mockRejectedValue(new Error('availability timeout'));

    const result = await checkLinksWithHttp([waybackLink], undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get(waybackLink.link)).toStrictEqual({
      state: 'transient', error: 'availability timeout',
    });
  });

  it('should classify Wayback API HTTP failures normally', async () => {
    const waybackLink = {
      link: 'https://web.archive.org/web/20120401201535/http://example.com/page',
      text: 'Archived page',
    };
    fetchMock.mockResolvedValue(new Response(null, { status: 503, statusText: 'Unavailable' }));

    const result = await checkLinksWithHttp([waybackLink], undefined, {
      fetchFn: fetchMock,
      sleep: sleepMock,
      now: () => now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.get(waybackLink.link)).toStrictEqual(expect.objectContaining({
      state: 'transient', status: 503,
    }));
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
