import {
  describe, it, expect, jest, beforeEach, afterEach,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

const moduleMockApi = WikiApiMock();

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  __esModule: true,
  default: () => moduleMockApi,
}));

const { main } = await import('../dlq/index');

describe('dlq handler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z')); // Monday - not Shabath
    jest.clearAllMocks();
    moduleMockApi.articleContent.mockResolvedValue({ content: '', revid: 123 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should write a log entry for DLQ records and parse JSON body', async () => {
    const event = {
      Records: [
        {
          messageId: 'msg-1',
          body: '{"foo":"bar"}',
          attributes: {
            ApproximateReceiveCount: '1',
          },
        },
      ],
    };

    await main(event);

    expect(moduleMockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = moduleMockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===שגיאות===');
    expect(content).toContain('"source": "lambda-dlq"');
    expect(content).toContain('"messageId": "msg-1"');
    expect(content).toContain('"foo": "bar"');
  });

  it('should log info when no records are present', async () => {
    const event = { Records: [] as unknown[] };

    await main(event);

    expect(moduleMockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = moduleMockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===לוגים===');
    expect(content).toContain('DLQ event received with no records');
  });

  it('should handle undefined event', async () => {
    await main(undefined as unknown as { Records: unknown[] });

    expect(moduleMockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = moduleMockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('DLQ event received with no records');
  });

  it('should log raw body when JSON parsing fails', async () => {
    const event = {
      Records: [
        {
          messageId: 'msg-2',
          body: 'not-json',
        },
      ],
    };

    await main(event);

    expect(moduleMockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = moduleMockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('"messageId": "msg-2"');
    expect(content).toContain('"body": "not-json"');
  });

  it('should handle record without body', async () => {
    const event = {
      Records: [
        {
          messageId: 'msg-3',
        },
      ],
    };

    await main(event);

    expect(moduleMockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = moduleMockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('"messageId": "msg-3"');
  });

  it('should extract resource from body', async () => {
    const event = {
      Records: [
        {
          messageId: 'msg-4',
          body: JSON.stringify({ resources: 'type/resource-id' }),
        },
      ],
    };

    await main(event);

    const editCall = moduleMockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('"resource": "resource-id"');
  });

  it('should extract error message from attributes', async () => {
    const event = {
      Records: [
        {
          messageId: 'msg-5',
          messageAttributes: {
            ErrorMessage: 'Something went wrong',
          },
        },
      ],
    };

    await main(event);

    const editCall = moduleMockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('"errorMessage": "Something went wrong"');
  });
});
