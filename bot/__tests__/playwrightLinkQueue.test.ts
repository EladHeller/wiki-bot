import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const sendMock: any = jest.fn();
const sqsClientMock: any = jest.fn(() => ({
  send: sendMock,
}));
const sendMessageCommandMock: any = jest.fn((input: any) => input);
const logErrorMock: any = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-sqs', () => ({
  SQSClient: sqsClientMock,
  SendMessageCommand: sendMessageCommandMock,
}));

jest.unstable_mockModule('../utilities/logger', () => ({
  logger: {
    logError: logErrorMock,
  },
}));

const { queuePlaywrightLinkCheck } = await import('../tag-bot/actions/playwrightLinkQueue');

describe('queuePlaywrightLinkCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PLAYWRIGHT_CHECK_QUEUE_URL = 'https://queue';
  });

  it('should enqueue a payload to the SQS queue', async () => {
    sendMock.mockResolvedValue({});
    await queuePlaywrightLinkCheck({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [{ link: 'https://example.com', text: 'Example' }],
    });

    expect(sendMessageCommandMock).toHaveBeenCalledWith(expect.objectContaining({
      MessageBody: JSON.stringify({
        title: 'Page',
        commentSummary: 'Summary',
        commentId: '1',
        links: [{ link: 'https://example.com', text: 'Example' }],
      }),
    }));
  });

  it('should throw when queue url is missing', async () => {
    const previous = process.env.PLAYWRIGHT_CHECK_QUEUE_URL;
    delete process.env.PLAYWRIGHT_CHECK_QUEUE_URL;

    await expect(queuePlaywrightLinkCheck({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [],
    })).rejects.toThrow('Missing PLAYWRIGHT_CHECK_QUEUE_URL');

    process.env.PLAYWRIGHT_CHECK_QUEUE_URL = previous;

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('should log and rethrow send failures', async () => {
    sendMock.mockRejectedValueOnce(new Error('send failed'));
    process.env.PLAYWRIGHT_CHECK_QUEUE_URL = 'https://queue';

    await expect(queuePlaywrightLinkCheck({
      title: 'Page',
      commentSummary: 'Summary',
      commentId: '1',
      links: [],
    })).rejects.toThrow('send failed');

    expect(logErrorMock).toHaveBeenCalledWith(new Error('send failed'));
  });
});
