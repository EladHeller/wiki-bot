import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const closeMock: any = jest.fn();
const gotoMock: any = jest.fn();
const reloadMock: any = jest.fn();
const waitForTimeoutMock: any = jest.fn();
const titleMock: any = jest.fn();
const contentMock: any = jest.fn();
const pageMock = {
  goto: gotoMock,
  reload: reloadMock,
  waitForTimeout: waitForTimeoutMock,
  close: closeMock,
  title: titleMock,
  content: contentMock,
};
const newPageMock: any = jest.fn();
const browserCloseMock: any = jest.fn();
const contextCloseMock: any = jest.fn();
const newContextMock: any = jest.fn();
const launchMock: any = jest.fn();
const logErrorMock: any = jest.fn();
const wikiLoginMock: any = jest.fn();
const wikiAddCommentMock: any = jest.fn();
const wikiApiMock: any = jest.fn(() => ({
  login: wikiLoginMock,
  addComment: wikiAddCommentMock,
}));

jest.unstable_mockModule('playwright', () => ({
  chromium: {
    launch: launchMock,
  },
}));

jest.unstable_mockModule('../utilities/logger', () => ({
  logger: {
    logError: logErrorMock,
  },
}));

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: wikiApiMock,
}));

jest.unstable_mockModule('../decorators/botLoggerDecorator', () => ({
  default: (cb: any) => cb,
}));

const {
  handleEvent, handleQueueMessage, main, runLinkChecks,
} = await import('../tag-bot/playwrightCheck/index');

function response(status: number, statusText = '') {
  return {
    status: () => status,
    statusText: () => statusText,
  };
}

function queueBody(links: { link: string; text: string }[]) {
  return JSON.stringify({
    title: 'Page',
    commentSummary: 'Summary',
    commentId: '1',
    links,
  });
}

describe('tagBotPlaywrightCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    closeMock.mockResolvedValue(undefined);
    reloadMock.mockResolvedValue(response(200, 'OK'));
    waitForTimeoutMock.mockResolvedValue(undefined);
    titleMock.mockResolvedValue('Example');
    contentMock.mockResolvedValue('<html></html>');
    newPageMock.mockResolvedValue(pageMock);
    browserCloseMock.mockResolvedValue(undefined);
    contextCloseMock.mockResolvedValue(undefined);
    newContextMock.mockResolvedValue({
      newPage: newPageMock,
      close: contextCloseMock,
    });
    launchMock.mockResolvedValue({
      newContext: newContextMock,
      close: browserCloseMock,
    });
    wikiLoginMock.mockResolvedValue(undefined);
    wikiAddCommentMock.mockResolvedValue(undefined);
  });

  it('should process SQS records and post a success comment', async () => {
    gotoMock.mockResolvedValueOnce(response(200, 'OK'));

    await main({ Records: [{ body: queueBody([{ link: 'https://example.com/one', text: 'One' }]) }] });

    expect(wikiApiMock).toHaveBeenCalledWith();
    expect(newContextMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: 'he-IL',
      timezoneId: 'Asia/Jerusalem',
      extraHTTPHeaders: expect.objectContaining({
        'Accept-Language': expect.any(String),
      }),
    }));
    expect(newContextMock.mock.calls[0][0]).not.toHaveProperty('userAgent');
    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      'כל הקישורים שנבדקו ברקע תקינים',
      '1',
    );
  });

  it('should return immediately without launching a browser when there are no links', async () => {
    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, JSON.stringify({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
    }));

    expect(launchMock).not.toHaveBeenCalled();
    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      'כל הקישורים שנבדקו ברקע תקינים',
      '1',
    );
  });

  it('should accept a link when a challenge retry succeeds', async () => {
    gotoMock.mockResolvedValueOnce(response(403, 'Forbidden'));
    reloadMock.mockResolvedValueOnce(response(200, 'OK'));

    const result = await runLinkChecks([{ link: 'https://example.com/one', text: 'One' }]);

    expect(waitForTimeoutMock).toHaveBeenCalledWith(5000);
    expect(reloadMock).toHaveBeenCalledWith(expect.objectContaining({ waitUntil: 'domcontentloaded' }));
    expect(result.results[0]).toStrictEqual(expect.objectContaining({ state: 'alive', ok: true, status: 200 }));
  });

  it('should report blocked and dead links in separate sections', async () => {
    gotoMock
      .mockResolvedValueOnce(response(403, 'Forbidden'))
      .mockResolvedValueOnce(response(404, 'Not Found'));
    reloadMock.mockResolvedValueOnce(response(403, 'Forbidden'));

    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, queueBody([
      { link: 'https://example.com/blocked', text: 'Blocked' },
      { link: 'https://example.com/dead', text: 'Dead' },
    ]));

    const comment = wikiAddCommentMock.mock.calls[0][2];

    expect(comment).toContain('קישורים שבורים בבדיקה ברקע');
    expect(comment).toContain('קישורים שלא ניתן היה לאמת בבדיקה ברקע');
    expect(comment).toContain('לא ניתן לאמת את הקישור - 403 - Forbidden');
    expect(comment).toContain('לא ניתן להגיע לקישור - 404 - Not Found');
  });

  it('should classify a challenge page behind a 503 response as blocked', async () => {
    gotoMock.mockResolvedValueOnce(response(503, 'Unavailable'));
    reloadMock.mockResolvedValueOnce(response(503, 'Unavailable'));
    titleMock.mockResolvedValueOnce('Just a moment');

    const result = await runLinkChecks([{ link: 'https://example.com/one', text: 'One' }]);

    expect(result.results[0]).toStrictEqual(expect.objectContaining({ state: 'blocked', ok: false }));
  });

  it('should retain the initial response when challenge reload fails', async () => {
    gotoMock.mockResolvedValueOnce(response(503, 'Unavailable'));
    reloadMock.mockRejectedValueOnce(new Error('reload failed'));

    const result = await runLinkChecks([{ link: 'https://example.com/one', text: 'One' }]);

    expect(result.results[0]).toStrictEqual(expect.objectContaining({ state: 'transient', status: 503 }));
  });

  it('should retain the initial response when challenge reload has no response', async () => {
    gotoMock.mockResolvedValueOnce(response(429, 'Too Many Requests'));
    reloadMock.mockResolvedValueOnce(undefined);
    titleMock.mockRejectedValueOnce(new Error('missing title'));
    contentMock.mockRejectedValueOnce(new Error('missing content'));

    const result = await runLinkChecks([{ link: 'https://example.com/one', text: 'One' }]);

    expect(result.results[0]).toStrictEqual(expect.objectContaining({ state: 'blocked', status: 429 }));
  });

  it.each([
    ['string', 'blocked'],
    ['Error', new Error('blocked')],
  ])('should report %s navigation failures as unresolved', async (_label, failure) => {
    gotoMock.mockRejectedValueOnce(failure);

    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, queueBody([{ link: 'https://example.com/one', text: 'One' }]));

    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      expect.stringContaining('blocked'),
      '1',
    );
  });

  it('should classify missing navigation responses as unknown', async () => {
    gotoMock.mockResolvedValueOnce(undefined);

    const result = await runLinkChecks([{ link: 'https://example.com/one', text: 'One' }]);

    expect(result.results[0]).toStrictEqual(expect.objectContaining({
      state: 'unknown', ok: false, status: 0, statusText: '',
    }));
  });

  it('should ignore SQS records without body', async () => {
    await main({ Records: [{}] });

    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });

  it('should skip posting when comment metadata is missing', async () => {
    gotoMock.mockResolvedValueOnce(response(200, 'OK'));

    await main({ Records: [{ body: JSON.stringify({ links: [{ link: 'https://example.com', text: 'One' }] }) }] });

    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });

  it('should ignore SQS events without records', async () => {
    await handleEvent({});

    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });
});
