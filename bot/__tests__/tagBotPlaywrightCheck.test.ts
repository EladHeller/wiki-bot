import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const closeMock: any = jest.fn();
closeMock.mockResolvedValue(undefined);
const gotoMock: any = jest.fn();
const titleMock: any = jest.fn();
titleMock.mockResolvedValue('Example');
const pageMock = {
  goto: gotoMock,
  close: closeMock,
  title: titleMock,
};
const newPageMock: any = jest.fn();
newPageMock.mockResolvedValue(pageMock);
const browserCloseMock: any = jest.fn();
browserCloseMock.mockResolvedValue(undefined);
const contextCloseMock: any = jest.fn();
contextCloseMock.mockResolvedValue(undefined);
const newContextMock: any = jest.fn();
newContextMock.mockResolvedValue({
  newPage: newPageMock,
  close: contextCloseMock,
});
const launchMock: any = jest.fn();
launchMock.mockResolvedValue({
  newContext: newContextMock,
  close: browserCloseMock,
});
const logErrorMock: any = jest.fn();
const wikiLoginMock: any = jest.fn(() => Promise.resolve(undefined));
const wikiAddCommentMock: any = jest.fn(() => Promise.resolve(undefined));
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

const { handleEvent, handleQueueMessage, main } = await import('../tag-bot/playwrightCheck/index');

describe('tagBotPlaywrightCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wikiLoginMock.mockReset();
    wikiLoginMock.mockResolvedValue(undefined);
    wikiAddCommentMock.mockReset();
    wikiAddCommentMock.mockResolvedValue(undefined);
  });

  it('should process SQS records and post a follow-up comment', async () => {
    gotoMock.mockResolvedValueOnce({
      ok: () => true,
      status: () => 200,
      statusText: () => 'OK',
    });

    await main({
      Records: [{
        body: JSON.stringify({
          title: 'Page',
          commentSummary: 'Summary',
          commentId: '1',
          links: [{ link: 'https://example.com/one', text: 'One' }],
        }),
      }],
    });

    expect(wikiApiMock).toHaveBeenCalledWith();
    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      'כל הקישורים שנבדקו ברקע תקינים',
      '1',
    );
  });

  it('should process queue messages without links', async () => {
    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, JSON.stringify({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
    }));

    expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({
      headless: true,
    }));
    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      'כל הקישורים שנבדקו ברקע תקינים',
      '1',
    );
  });

  it('should post a failure comment for blocked links in queue messages', async () => {
    gotoMock.mockResolvedValueOnce({
      ok: () => false,
      status: () => 403,
      statusText: () => 'Forbidden',
    });

    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, JSON.stringify({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [{ link: 'https://example.com/one', text: 'One' }],
    }));

    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      expect.stringContaining('קישורים שנכשלו בבדיקה ברקע'),
      '1',
    );
  });

  it('should handle string navigation failures in queue messages', async () => {
    gotoMock.mockRejectedValueOnce('blocked');

    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, JSON.stringify({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [{ link: 'https://example.com/one', text: 'One' }],
    }));

    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      expect.stringContaining('blocked'),
      '1',
    );
  });

  it('should handle Error navigation failures in queue messages', async () => {
    gotoMock.mockRejectedValueOnce(new Error('blocked'));

    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, JSON.stringify({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [{ link: 'https://example.com/one', text: 'One' }],
    }));

    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      expect.stringContaining('blocked'),
      '1',
    );
  });

  it('should handle missing navigation responses in queue messages', async () => {
    gotoMock.mockResolvedValueOnce(undefined);

    await handleQueueMessage({
      addComment: wikiAddCommentMock,
    } as ReturnType<typeof wikiApiMock>, JSON.stringify({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [{ link: 'https://example.com/one', text: 'One' }],
    }));

    expect(wikiAddCommentMock).toHaveBeenCalledWith(
      'Page',
      'Summary',
      expect.stringContaining('לא ניתן להגיע לקישור - 0 - '),
      '1',
    );
  });

  it('should ignore SQS records without body', async () => {
    await main({
      Records: [{}],
    });

    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });

  it('should skip posting when comment metadata is missing', async () => {
    gotoMock.mockResolvedValueOnce({
      ok: () => true,
      status: () => 200,
      statusText: () => 'OK',
    });

    await main({
      Records: [{
        body: JSON.stringify({
          links: [{ link: 'https://example.com/one', text: 'One' }],
        }),
      }],
    });

    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });

  it('should ignore SQS events without records', async () => {
    await handleEvent({});

    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });
});
