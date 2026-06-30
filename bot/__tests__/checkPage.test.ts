import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const getExternalLinksMock = jest.fn<() => Array<{ link: string; text: string }>>();
const handlePageMock = jest.fn() as any;
const logErrorMock: any = jest.fn();
const axiosCreateMock: any = jest.fn();
const wrapperMock: any = jest.fn((client: any) => client);
const cookieJarMock: any = jest.fn(() => ({ cookieJar: true }));
const queuePlaywrightLinkCheckMock: any = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: {
    create: axiosCreateMock,
  },
}));

jest.unstable_mockModule('axios-cookiejar-support', () => ({
  wrapper: wrapperMock,
}));

jest.unstable_mockModule('tough-cookie', () => ({
  CookieJar: cookieJarMock,
}));

jest.unstable_mockModule('../wiki/wikiLinkParser', () => ({
  getExternalLinks: getExternalLinksMock,
}));

jest.unstable_mockModule('../maintenance/copyrightViolationCore', () => ({
  handlePage: handlePageMock,
}));

jest.unstable_mockModule('../utilities/logger', () => ({
  logger: {
    logError: logErrorMock,
  },
}));

jest.unstable_mockModule('../tag-bot/actions/playwrightLinkQueue', () => ({
  queuePlaywrightLinkCheck: queuePlaywrightLinkCheckMock,
}));

const { checkCopyright, checkExternalLinks } = await import('../tag-bot/actions/checkPage');

describe('checkExternalLinks', () => {
  const mockClient: any = {
    get: jest.fn<(url: string, config?: Record<string, any>) => Promise<any>>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queuePlaywrightLinkCheckMock.mockReset();
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
      { link: 'https://example.com/two', text: 'Two' },
    ]);
  });

  it('should create one cookie-aware client and return success when all links are reachable', async () => {
    mockClient.get.mockResolvedValue({
      status: 200,
      statusText: 'OK',
    });
    axiosCreateMock.mockReturnValue(mockClient);

    await checkExternalLinks('content');

    const clientConfig = axiosCreateMock.mock.calls[0][0];
    clientConfig.validateStatus(403);

    expect(cookieJarMock).toHaveBeenCalledWith();
    expect(axiosCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      jar: expect.any(Object),
      validateStatus: expect.any(Function),
      headers: expect.objectContaining({
        'User-Agent': expect.stringContaining('Chrome/149.0.0.0'),
      }),
    }));
    expect(wrapperMock).toHaveBeenCalledWith(mockClient);
    expect(mockClient.get).toHaveBeenNthCalledWith(1, 'https://example.com/one', { responseType: 'text' });
    expect(mockClient.get).toHaveBeenNthCalledWith(2, 'https://example.com/two', { responseType: 'text' });
  });

  it('should return success when all links are reachable', async () => {
    mockClient.get.mockResolvedValue({
      status: 200,
      statusText: 'OK',
    });
    axiosCreateMock.mockReturnValue(mockClient);
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
    ]);

    const result = await checkExternalLinks('content', mockClient);

    expect(result).toBe('כל הקישורים תקינים');
  });

  it('should report non-2xx responses as broken links', async () => {
    mockClient.get
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      })
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      });
    axiosCreateMock.mockReturnValue(mockClient);
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
    expect(result).toBe('כל הקישורים שנגישים לבוט תקינים. קישורים שחסומים לבוט נשלחו לבדיקה ברקע: https://example.com/two');
  });

  it('should report playwright failures as broken links', async () => {
    mockClient.get
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      })
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      });
    axiosCreateMock.mockReturnValue(mockClient);
    queuePlaywrightLinkCheckMock.mockRejectedValue(new Error('queue failed'));

    const result = await checkExternalLinks('content');

    expect(result).toBe('חלק מהקישורים חסומים לבוט ונשלחו לבדיקה ברקע. קישורים שבורים:\n* [https://example.com/two Two], לא ניתן להעביר לבדיקה ברקע - queue failed');
  });

  it('should report playwright status text when error is absent', async () => {
    mockClient.get
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      })
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      });
    axiosCreateMock.mockReturnValue(mockClient);
    queuePlaywrightLinkCheckMock.mockResolvedValue(undefined);

    const result = await checkExternalLinks('content');

    expect(result).toBe('כל הקישורים שנגישים לבוט תקינים. קישורים שחסומים לבוט נשלחו לבדיקה ברקע: https://example.com/two');
  });

  it('should report the default playwright failure message when status fields are absent', async () => {
    mockClient.get
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      })
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      });
    axiosCreateMock.mockReturnValue(mockClient);
    queuePlaywrightLinkCheckMock.mockResolvedValue(undefined);

    const result = await checkExternalLinks('content');

    expect(result).toBe('כל הקישורים שנגישים לבוט תקינים. קישורים שחסומים לבוט נשלחו לבדיקה ברקע: https://example.com/two');
  });

  it('should report playwright invocation failures as broken links', async () => {
    mockClient.get
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      })
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      });
    axiosCreateMock.mockReturnValue(mockClient);
    queuePlaywrightLinkCheckMock.mockRejectedValue(new Error('queue failed'));

    const result = await checkExternalLinks('content');

    expect(result).toBe('חלק מהקישורים חסומים לבוט ונשלחו לבדיקה ברקע. קישורים שבורים:\n* [https://example.com/two Two], לא ניתן להעביר לבדיקה ברקע - queue failed');
  });

  it('should report string playwright invocation failures as broken links', async () => {
    mockClient.get
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
      })
      .mockResolvedValueOnce({
        status: 403,
        statusText: 'Forbidden',
      });
    axiosCreateMock.mockReturnValue(mockClient);
    queuePlaywrightLinkCheckMock.mockRejectedValue('queue failed');

    const result = await checkExternalLinks('content');

    expect(result).toBe('חלק מהקישורים חסומים לבוט ונשלחו לבדיקה ברקע. קישורים שבורים:\n* [https://example.com/two Two], לא ניתן להעביר לבדיקה ברקע - queue failed');
  });

  it('should report non-403 status codes as broken links without playwright', async () => {
    mockClient.get.mockResolvedValueOnce({
      status: 500,
      statusText: 'Internal Server Error',
    });
    axiosCreateMock.mockReturnValue(mockClient);

    const result = await checkExternalLinks('content', mockClient);

    expect(queuePlaywrightLinkCheckMock).not.toHaveBeenCalled();
    expect(result).toBe('קישורים שבורים:\n* [https://example.com/one One], לא ניתן להגיע לקישור - 500 - Internal Server Error');
  });

  it('should log request errors and include them in the report', async () => {
    mockClient.get.mockRejectedValueOnce('boom');
    axiosCreateMock.mockReturnValue(mockClient);
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
    ]);

    const result = await checkExternalLinks('content', mockClient);

    expect(logErrorMock).toHaveBeenCalledWith('boom');
    expect(result).toBe('קישורים שבורים:\n* [https://example.com/one One], boom');
  });

  it('should log Error objects and include their message', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('kaboom'));
    axiosCreateMock.mockReturnValue(mockClient);
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
    ]);

    const result = await checkExternalLinks('content', mockClient);

    expect(logErrorMock).toHaveBeenCalledWith(new Error('kaboom'));
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
