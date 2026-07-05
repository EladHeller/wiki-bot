import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const getExternalLinksMock = jest.fn<() => Array<{ link: string; text: string }>>();
const handlePageMock = jest.fn() as any;
const queuePlaywrightLinkCheckMock: any = jest.fn();
const fetchMock = jest.fn<typeof fetch>();

jest.unstable_mockModule('../wiki/wikiLinkParser', () => ({
  getExternalLinks: getExternalLinksMock,
}));

jest.unstable_mockModule('../maintenance/copyrightViolationCore', () => ({
  handlePage: handlePageMock,
}));

jest.unstable_mockModule('../tag-bot/actions/playwrightLinkQueue', () => ({
  queuePlaywrightLinkCheck: queuePlaywrightLinkCheckMock,
}));

const { checkCopyright, checkExternalLinks } = await import('../tag-bot/actions/checkPage');

describe('checkExternalLinks', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
      { link: 'https://example.com/two', text: 'Two' },
    ]);
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('should return success when all links are reachable', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
    } as Response);

    const result = await checkExternalLinks('content');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/one',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/two',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.any(String),
        }),
      }),
    );
    expect(result).toBe('כל הקישורים תקינים');
  });

  it('should report non-2xx responses as broken links', async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      } as Response)
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      } as Response);
    queuePlaywrightLinkCheckMock.mockResolvedValue(undefined);

    const result = await checkExternalLinks('content');

    expect(queuePlaywrightLinkCheckMock).toHaveBeenCalledWith({
      title: '',
      commentSummary: '',
      commentId: '',
      links: [
        { link: 'https://example.com/two', text: 'Two' },
      ],
    });
    expect(result).toBe('כל הקישורים שנגישים לבוט תקינים. קישורים שחסומים לבוט נשלחו לבדיקה ברקע.');
  });

  it('should report playwright failures as broken links', async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      } as Response)
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      } as Response);
    queuePlaywrightLinkCheckMock.mockRejectedValue(new Error('queue failed'));

    const result = await checkExternalLinks('content');

    expect(result).toBe('חלק מהקישורים חסומים לבוט ונשלחו לבדיקה ברקע. קישורים שבורים:\n* [https://example.com/two Two], לא ניתן להעביר לבדיקה ברקע - queue failed');
  });

  it('should format non-Error playwright failures as strings', async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      } as Response);
    queuePlaywrightLinkCheckMock.mockRejectedValue({ reason: 'queue failed' });
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
    ]);

    const result = await checkExternalLinks('content');

    expect(consoleErrorSpy).toHaveBeenCalledWith({ reason: 'queue failed' });
    expect(result).toBe('חלק מהקישורים חסומים לבוט ונשלחו לבדיקה ברקע. קישורים שבורים:\n* [https://example.com/one One], לא ניתן להעביר לבדיקה ברקע - [object Object]');
  });

  it('should report non-403 status codes as broken links without playwright', async () => {
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
    ]);
    fetchMock.mockResolvedValueOnce({
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const result = await checkExternalLinks('content');

    expect(queuePlaywrightLinkCheckMock).not.toHaveBeenCalled();
    expect(result).toBe('קישורים שבורים:\n* [https://example.com/one One], לא ניתן להגיע לקישור - 500 - Internal Server Error');
  });

  it('should log request errors and include them in the report', async () => {
    fetchMock.mockRejectedValueOnce('boom');
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
    ]);

    const result = await checkExternalLinks('content');

    expect(consoleErrorSpy).toHaveBeenCalledWith('boom');
    expect(result).toBe('קישורים שבורים:\n* [https://example.com/one One], boom');
  });

  it('should log Error objects and include their message', async () => {
    fetchMock.mockRejectedValueOnce(new Error('kaboom'));
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
    ]);

    const result = await checkExternalLinks('content');

    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('kaboom'));
    expect(result).toBe('קישורים שבורים:\n* [https://example.com/one One], kaboom');
  });
});

describe('checkCopyright', () => {
  it('should concatenate page logs', async () => {
    handlePageMock.mockResolvedValue({
      logs: ['אחת', 'שתיים'],
      otherLogs: ['שלוש'],
    });

    const result = await checkCopyright('דף בדיקה');

    expect(handlePageMock).toHaveBeenCalledWith('דף בדיקה', true);
    expect(result).toBe('* אחת\n* שתיים\n* שלוש');
  });

  it('should pass false for namespaced titles', async () => {
    handlePageMock.mockResolvedValue({
      logs: [],
      otherLogs: [],
    });

    await checkCopyright('תבנית:בדיקה');

    expect(handlePageMock).toHaveBeenCalledWith('תבנית:בדיקה', false);
  });
});
