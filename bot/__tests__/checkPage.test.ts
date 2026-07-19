import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import { LinkCheckResult } from '../tag-bot/actions/externalLinkChecker';

const getExternalLinksMock = jest.fn<() => Array<{ link: string; text: string }>>();
const handlePageMock = jest.fn() as any;
const queuePlaywrightLinkCheckMock: any = jest.fn();
const checkLinksWithHttpMock: any = jest.fn();
const lookupIABotLinksMock: any = jest.fn();
const logErrorMock: any = jest.fn();
const logWarningMock: any = jest.fn();

jest.unstable_mockModule('../wiki/wikiLinkParser', () => ({
  getExternalLinks: getExternalLinksMock,
}));

jest.unstable_mockModule('../maintenance/copyrightViolationCore', () => ({
  handlePage: handlePageMock,
}));

jest.unstable_mockModule('../tag-bot/actions/playwrightLinkQueue', () => ({
  queuePlaywrightLinkCheck: queuePlaywrightLinkCheckMock,
}));

jest.unstable_mockModule('../tag-bot/actions/externalLinkChecker', () => ({
  checkLinksWithHttp: checkLinksWithHttpMock,
}));

jest.unstable_mockModule('../tag-bot/actions/internetArchiveBot', () => ({
  lookupIABotLinks: lookupIABotLinksMock,
}));

jest.unstable_mockModule('../utilities/logger', () => ({
  logger: {
    logError: logErrorMock,
    logWarning: logWarningMock,
  },
}));

const { checkCopyright, checkExternalLinks } = await import('../tag-bot/actions/checkPage');

function httpResults(entries: Array<[string, LinkCheckResult]>) {
  checkLinksWithHttpMock.mockResolvedValue(new Map(entries));
}

describe('checkExternalLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getExternalLinksMock.mockReturnValue([
      { link: 'https://example.com/one', text: 'One' },
      { link: 'https://example.com/two', text: 'Two' },
    ]);
    queuePlaywrightLinkCheckMock.mockResolvedValue(undefined);
    lookupIABotLinksMock.mockResolvedValue(new Map());
  });

  it('should return success when all links are reachable', async () => {
    httpResults([
      ['https://example.com/one', { state: 'alive', status: 200, statusText: 'OK' }],
      ['https://example.com/two', { state: 'alive', status: 200, statusText: 'OK' }],
    ]);

    const result = await checkExternalLinks('content', {
      title: 'Page title', commentSummary: 'Summary', commentId: '1',
    });

    expect(checkLinksWithHttpMock).toHaveBeenCalledWith(expect.any(Array), 'Page title');
    expect(lookupIABotLinksMock).not.toHaveBeenCalled();
    expect(queuePlaywrightLinkCheckMock).not.toHaveBeenCalled();
    expect(result).toBe('כל הקישורים תקינים');
  });

  it('should accept an alive IABot result for a blocked link', async () => {
    httpResults([
      ['https://example.com/one', { state: 'alive', status: 200 }],
      ['https://example.com/two', { state: 'blocked', status: 403 }],
    ]);
    lookupIABotLinksMock.mockResolvedValue(new Map([['https://example.com/two', 'alive']]));

    const result = await checkExternalLinks('content');

    expect(queuePlaywrightLinkCheckMock).not.toHaveBeenCalled();
    expect(result).toBe('כל הקישורים תקינים');
  });

  it('should report an IABot-confirmed dead link as broken', async () => {
    httpResults([
      ['https://example.com/one', { state: 'alive', status: 200 }],
      ['https://example.com/two', { state: 'blocked', status: 403, statusText: 'Forbidden' }],
    ]);
    lookupIABotLinksMock.mockResolvedValue(new Map([['https://example.com/two', 'dead']]));

    const result = await checkExternalLinks('content');

    expect(result).toBe('קישורים שבורים:\n* [https://example.com/two Two], לא ניתן להגיע לקישור - 403 - Forbidden');
  });

  it('should queue blocked, transient, and unknown links for a background check', async () => {
    httpResults([
      ['https://example.com/one', { state: 'alive', status: 200 }],
      ['https://example.com/two', { state: 'blocked', status: 403 }],
    ]);

    const result = await checkExternalLinks('content', {
      title: 'Page', commentSummary: 'Summary', commentId: '1',
    });

    expect(queuePlaywrightLinkCheckMock).toHaveBeenCalledWith({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [{ link: 'https://example.com/two', text: 'Two' }],
    });
    expect(result).toBe('כל הקישורים שניתן היה לאמת תקינים. קישורים שלא ניתן היה לאמת נשלחו לבדיקה ברקע.');
  });

  it('should keep a repeatedly missing link broken when IABot has no result', async () => {
    getExternalLinksMock.mockReturnValue([{ link: 'https://example.com/one', text: 'One' }]);
    httpResults([['https://example.com/one', { state: 'dead', status: 404, statusText: 'Not Found' }]]);

    const result = await checkExternalLinks('content');

    expect(result).toBe('קישורים שבורים:\n* [https://example.com/one One], לא ניתן להגיע לקישור - 404 - Not Found');
  });

  it('should format broken links with errors or without HTTP details', async () => {
    httpResults([
      ['https://example.com/one', { state: 'dead', error: 'DNS failure' }],
      ['https://example.com/two', { state: 'dead' }],
    ]);

    const result = await checkExternalLinks('content');

    expect(result).toContain('* [https://example.com/one One], DNS failure');
    expect(result).toContain('* [https://example.com/two Two], לא ניתן לקבוע אם הקישור תקין');
  });

  it('should report broken links while unresolved links continue in the background', async () => {
    httpResults([
      ['https://example.com/one', { state: 'dead', status: 404 }],
      ['https://example.com/two', { state: 'blocked', status: 403 }],
    ]);

    const result = await checkExternalLinks('content');

    expect(result).toContain('קישורים שלא ניתן היה לאמת נשלחו לבדיקה ברקע.');
    expect(result).toContain('לא ניתן להגיע לקישור - 404 - ');
  });

  it('should fall back to the background check when IABot fails', async () => {
    getExternalLinksMock.mockReturnValue([{ link: 'https://example.com/one', text: 'One' }]);
    httpResults([['https://example.com/one', { state: 'blocked', status: 403 }]]);
    lookupIABotLinksMock.mockRejectedValue(new Error('IABot unavailable'));

    const result = await checkExternalLinks('content');

    expect(logWarningMock).toHaveBeenCalledWith(new Error('IABot unavailable'));
    expect(queuePlaywrightLinkCheckMock).toHaveBeenCalledWith(expect.any(Object));
    expect(result).toContain('נשלחו לבדיקה ברקע');
  });

  it('should report a queue failure as unverifiable rather than broken', async () => {
    getExternalLinksMock.mockReturnValue([{ link: 'https://example.com/one', text: 'One' }]);
    httpResults([['https://example.com/one', { state: 'transient', error: 'timeout' }]]);
    queuePlaywrightLinkCheckMock.mockRejectedValue(new Error('queue failed'));

    const result = await checkExternalLinks('content');

    expect(logErrorMock).toHaveBeenCalledWith(new Error('queue failed'));
    expect(result).toBe('קישורים שלא ניתן היה לאמת:\n* [https://example.com/one One], לא ניתן להעביר לבדיקה ברקע - queue failed');
    expect(result).not.toContain('קישורים שבורים');
  });

  it('should format non-Error queue failures', async () => {
    getExternalLinksMock.mockReturnValue([{ link: 'https://example.com/one', text: 'One' }]);
    httpResults([['https://example.com/one', { state: 'transient' }]]);
    queuePlaywrightLinkCheckMock.mockRejectedValue('queue unavailable');

    const result = await checkExternalLinks('content');

    expect(result).toContain('לא ניתן להעביר לבדיקה ברקע - queue unavailable');
  });

  it('should handle a missing HTTP result as unverifiable', async () => {
    getExternalLinksMock.mockReturnValue([{ link: 'https://example.com/one', text: 'One' }]);
    checkLinksWithHttpMock.mockResolvedValue(new Map());

    const result = await checkExternalLinks('content');

    expect(queuePlaywrightLinkCheckMock).toHaveBeenCalledWith(expect.any(Object));
    expect(result).toContain('נשלחו לבדיקה ברקע');
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
