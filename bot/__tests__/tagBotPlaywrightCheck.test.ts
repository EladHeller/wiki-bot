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

const { handleEvent, handleQueueMessage, main } = await import('../tag-bot/playwrightCheck/index');

describe('tagBotPlaywrightCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wikiLoginMock.mockReset();
    wikiLoginMock.mockResolvedValue(undefined);
    wikiAddCommentMock.mockReset();
    wikiAddCommentMock.mockResolvedValue(undefined);
  });

  it('should return empty results for empty input', async () => {
    const result = await main({});

    expect(result).toStrictEqual({ results: [] });
    expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({
      headless: true,
    }));
  });

  it('should check links and close resources', async () => {
    gotoMock
      .mockResolvedValueOnce({
        ok: () => true,
        status: () => 200,
        statusText: () => 'OK',
      })
      .mockRejectedValueOnce(new Error('blocked'));

    const result = await main({
      links: [
        { link: 'https://example.com/one', text: 'One' },
        { link: 'https://example.com/two', text: 'Two' },
      ],
    });

    expect(result).toStrictEqual({
      results: [
        {
          link: 'https://example.com/one',
          text: 'One',
          ok: true,
          status: 200,
          statusText: 'OK',
        },
        {
          link: 'https://example.com/two',
          text: 'Two',
          ok: false,
          status: 0,
          statusText: '',
          error: 'blocked',
        },
      ],
    });
    expect(newContextMock).toHaveBeenCalledWith(expect.objectContaining({
      userAgent: expect.stringContaining('Chrome/149.0.0.0'),
    }));
    expect(newPageMock).toHaveBeenCalledTimes(2);
  });

  it('should close browser resources after checking links', async () => {
    gotoMock.mockResolvedValue({
      ok: () => true,
      status: () => 200,
      statusText: () => 'OK',
    });

    await main({
      links: [{ link: 'https://example.com/one', text: 'One' }],
    });

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(contextCloseMock).toHaveBeenCalledWith();
    expect(browserCloseMock).toHaveBeenCalledWith();
  });

  it('should treat a string navigation error as a failed link', async () => {
    gotoMock.mockRejectedValueOnce('blocked');

    const result = await main({
      links: [{ link: 'https://example.com/one', text: 'One' }],
    });

    expect(result).toStrictEqual({
      results: [{
        link: 'https://example.com/one',
        text: 'One',
        ok: false,
        status: 0,
        statusText: '',
        error: 'blocked',
      }],
    });
  });

  it('should log and rethrow browser launch errors', async () => {
    launchMock.mockRejectedValueOnce(new Error('launch failed'));

    await expect(main({
      links: [{ link: 'https://example.com', text: 'Example' }],
    })).rejects.toThrow('launch failed');

    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('should treat a missing navigation response as a failed link', async () => {
    gotoMock.mockResolvedValueOnce(undefined);

    const result = await main({
      links: [{ link: 'https://example.com/one', text: 'One' }],
    });

    expect(result).toStrictEqual({
      results: [{
        link: 'https://example.com/one',
        text: 'One',
        ok: false,
        status: 0,
        statusText: '',
      }],
    });
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

  it('should post a failure comment for blocked links in SQS mode', async () => {
    gotoMock.mockResolvedValueOnce({
      ok: () => false,
      status: () => 403,
      statusText: () => 'Forbidden',
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
      expect.stringContaining('קישורים שנכשלו בבדיקה ברקע'),
      '1',
    );
  });

  it('should ignore empty SQS records', async () => {
    await main({
      Records: [],
    });

    expect(wikiLoginMock).toHaveBeenCalledWith();
    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });

  it('should ignore SQS records without body', async () => {
    await main({
      Records: [{}],
    });

    expect(wikiLoginMock).toHaveBeenCalledWith();
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

  it('should use an empty link list when queue messages omit links', async () => {
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

  it('should ignore SQS events without records', async () => {
    await handleEvent({});

    expect(wikiLoginMock).toHaveBeenCalledWith();
    expect(wikiAddCommentMock).not.toHaveBeenCalled();
  });
});
