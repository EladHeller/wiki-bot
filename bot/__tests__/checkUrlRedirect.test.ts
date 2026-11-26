import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const fetchMock: any = jest.fn();
const launchMock: any = jest.fn();
const newPageMock: any = jest.fn();
const gotoMock: any = jest.fn();
const waitForURLMock: any = jest.fn();
const pageUrlMock: any = jest.fn();
const pageCloseMock: any = jest.fn();
const browserCloseMock: any = jest.fn();
const logErrorMock: any = jest.fn();

jest.unstable_mockModule('playwright', () => ({ chromium: { launch: launchMock } }));
jest.unstable_mockModule('../utilities/playwright', () => ({ default: () => ({ headless: true }) }));
jest.unstable_mockModule('../utilities/logger', () => ({ logger: { logError: logErrorMock } }));

const { default: createUrlRedirectChecker } = await import('../utilities/checkUrlRedirect');
const googleUrl = 'https://www.google.com/goto?url=encoded';
const articleUrl = 'https://news.walla.co.il/item/123';
const urlRegex = /https:\/\/([^.]+)\.walla\.co\.il\/([^/]+(?:\/[^/]+)?)\/(\d+)/i;

describe('checkUrlRedirect', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
    fetchMock.mockResolvedValue({ status: 200, url: googleUrl });
    launchMock.mockResolvedValue({ newPage: newPageMock, close: browserCloseMock });
    newPageMock.mockResolvedValue({
      goto: gotoMock,
      waitForURL: waitForURLMock,
      url: pageUrlMock,
      close: pageCloseMock,
    });
    pageUrlMock.mockReturnValue(articleUrl);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an HTTP redirect without launching a browser', async () => {
    fetchMock.mockResolvedValue({ status: 200, url: articleUrl });
    const checker = createUrlRedirectChecker(urlRegex);

    await expect(checker.checkUrlRedirect(googleUrl)).resolves.toBe(articleUrl);

    await checker.closeBrowser();

    expect(fetchMock).toHaveBeenCalledWith(googleUrl, {
      redirect: 'follow', signal: expect.any(AbortSignal),
    });
    expect(launchMock).not.toHaveBeenCalled();
  });

  it.each([
    { status: 403, url: googleUrl },
    { status: 200, url: 'https://www.walla.co.il/tags/example' },
    { status: 200, url: 'https://www.google.com/sorry' },
    { status: 200, url: 'https://www.google.com.example.org/goto' },
  ])('returns the original URL for an unsupported response %j', async (response) => {
    fetchMock.mockResolvedValue(response);
    const checker = createUrlRedirectChecker(urlRegex);

    await expect(checker.checkUrlRedirect(googleUrl)).resolves.toBe(googleUrl);

    expect(launchMock).not.toHaveBeenCalled();
  });

  it('follows delayed browser navigation and closes the page', async () => {
    const checker = createUrlRedirectChecker(urlRegex);

    await expect(checker.checkUrlRedirect(googleUrl)).resolves.toBe(articleUrl);

    await checker.closeBrowser();

    expect(launchMock).toHaveBeenCalledWith({ headless: true });
    expect(gotoMock).toHaveBeenCalledWith(googleUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(waitForURLMock).toHaveBeenCalledWith(expect.any(Function), {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    expect(pageCloseMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['https://walla.co.il/item/123', true],
    [articleUrl, true],
    [googleUrl, false],
    ['https://fakewalla.co.il/item/123', false],
  ])('accepts only Walla navigation destinations: %s', async (url, expected) => {
    const checker = createUrlRedirectChecker(urlRegex);
    await checker.checkUrlRedirect(googleUrl);
    await checker.closeBrowser();
    const [matches] = waitForURLMock.mock.calls[0];

    expect(matches(new URL(url))).toBe(expected);
  });

  it('reuses Chromium until closed and can launch it again', async () => {
    const checker = createUrlRedirectChecker(urlRegex);
    await checker.checkUrlRedirect(googleUrl);
    await checker.checkUrlRedirect(googleUrl);
    await checker.closeBrowser();

    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(pageCloseMock).toHaveBeenCalledTimes(2);
    expect(browserCloseMock).toHaveBeenCalledTimes(1);

    await checker.checkUrlRedirect(googleUrl);
    await checker.closeBrowser();

    expect(launchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a browser destination without an article ID', async () => {
    pageUrlMock.mockReturnValue('https://www.walla.co.il/tags/example');
    const checker = createUrlRedirectChecker(urlRegex);

    await expect(checker.checkUrlRedirect(googleUrl)).resolves.toBe(googleUrl);

    await checker.closeBrowser();

    expect(pageCloseMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['goto', 1], ['waitForURL', 1], ['newPage', 0], ['launch', 0],
  ])('logs a %s failure and keeps the original URL', async (operation, closedPages) => {
    const mocks = {
      goto: gotoMock, waitForURL: waitForURLMock, newPage: newPageMock, launch: launchMock,
    };
    mocks[operation as keyof typeof mocks].mockRejectedValueOnce(new Error('Timed out'));
    const checker = createUrlRedirectChecker(urlRegex);

    await expect(checker.checkUrlRedirect(googleUrl)).resolves.toBe(googleUrl);

    await checker.closeBrowser();

    expect(logErrorMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).toHaveBeenCalledWith(
      `Failed to resolve Google URL ${googleUrl}: Timed out`,
    );
    expect(pageCloseMock).toHaveBeenCalledTimes(closedPages);
  });

  it('preserves fetch failures', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network failure'));
    const checker = createUrlRedirectChecker(urlRegex);

    await expect(checker.checkUrlRedirect(googleUrl)).rejects.toThrow('Network failure');

    expect(launchMock).not.toHaveBeenCalled();
  });
});
