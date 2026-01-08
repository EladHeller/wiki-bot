import {
  describe, expect, it, jest, beforeEach, afterEach,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { getLocalTimeAndDate } from '../utilities';
import { logger } from '../utilities/logger';

const moduleMockApi = WikiApiMock();
jest.unstable_mockModule('../wiki/WikiApi', () => ({
  __esModule: true,
  default: () => moduleMockApi,
}));

const { default: botLoggerDecorator } = await import('../decorators/botLoggerDecorator');

describe('botLoggerDecorator', () => {
  const mockApi = WikiApiMock();
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z')); // Monday - not Shabath
    jest.clearAllMocks();
    mockApi.articleContent.mockResolvedValue({ content: '', revid: 123 });
    moduleMockApi.articleContent.mockResolvedValue({ content: '', revid: 123 });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should execute the callback and return its result', async () => {
    const callback = jest.fn<() => Promise<string>>().mockResolvedValue('success');
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    const result = await decorated();

    expect(result).toBe('success');
    expect(callback).toHaveBeenCalledWith();
  });

  it('should not write logs to wiki when there are no logs', async () => {
    const callback = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).not.toHaveBeenCalled();
  });

  it('should write error logs to wiki', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה ראשונה');
      logger.logError('שגיאה שנייה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===שגיאות===');
    expect(content).toContain('* שגיאה ראשונה');
    expect(content).toContain('* שגיאה שנייה');
  });

  it('should write warning logs to wiki', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logWarning('אזהרה ראשונה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===אזהרות===');
    expect(content).toContain('* אזהרה ראשונה');
  });

  it('should catch thrown errors and write them to logs', async () => {
    const error = new Error('שגיאה קריטית');
    const callback = jest.fn<() => Promise<void>>().mockRejectedValue(error);
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await expect(decorated()).resolves.toBeUndefined();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===שגיאה שנזרקה===');
    expect(content).toContain('<div style="direction: ltr"><code>Error: שגיאה קריטית<br/>&nbsp;&nbsp;&nbsp;&nbsp;at Object.<anonymous> (');
  });

  it('should include bot name and date in heading', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט מיוחד', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('==בוט מיוחד -');
  });

  it('should add serial number to heading when same heading exists', async () => {
    const dateString = getLocalTimeAndDate(new Date().toISOString());
    mockApi.articleContent.mockResolvedValue({
      content: `==בוט בדיקה - ${dateString}==\nתוכן קודם\n`,
      revid: 123,
    });

    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toMatch(/==בוט בדיקה - .* \(2\)==/);
  });

  it('should increment serial number correctly', async () => {
    const dateString = getLocalTimeAndDate(new Date().toISOString());
    mockApi.articleContent.mockResolvedValue({
      content: `==בוט בדיקה - ${dateString}==\nתוכן\n==בוט בדיקה - ${dateString} (2)==\nתוכן\n`,
      revid: 123,
    });

    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toMatch(/==בוט בדיקה - .* \(3\)==/);
  });

  it('should respect Shabath protection', async () => {
    jest.setSystemTime(new Date('2024-01-20T12:00:00Z')); // Saturday - Shabath

    const callback = jest.fn<() => Promise<string>>().mockResolvedValue('success');
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    const result = await decorated();

    expect(result).toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
    expect(mockApi.edit).not.toHaveBeenCalled();
  });

  it('should handle both errors and warnings together', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
      logger.logWarning('אזהרה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===שגיאות===');
    expect(content).toContain('===אזהרות===');
  });

  it('should use correct edit summary', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט ארכיון', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const summary = editCall[1] as string;

    expect(summary).toBe('לוג ריצה: בוט ארכיון');
  });

  it('should write to correct log page', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.articleContent).toHaveBeenCalledWith('משתמש:Sapper-bot/לוג שגיאות');

    const editCall = mockApi.edit.mock.calls[0];

    expect(editCall[0]).toBe('משתמש:Sapper-bot/לוג שגיאות');
  });

  it('should add signature at the end of logs', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('~~~~');
  });

  it('should handle non-Error thrown values', async () => {
    const callback = jest.fn<() => Promise<void>>().mockRejectedValue('string error');
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await expect(decorated()).resolves.toBeUndefined();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===שגיאה שנזרקה===');
    expect(content).toContain('<div style="direction: ltr"><code>Error: string error<br/>&nbsp;&nbsp;&nbsp;&nbsp;at ');
  });

  it('should log to console when writing logs to wiki fails', async () => {
    mockApi.edit.mockRejectedValue(new Error('Wiki API error'));

    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to write logs to wiki:',
      expect.any(Error),
    );
  });

  it('should not throw when logging outside of context', () => {
    expect(() => logger.logError('שגיאה מחוץ לקונטקסט')).not.toThrow();
    expect(() => logger.logWarning('אזהרה מחוץ לקונטקסט')).not.toThrow();
  });

  it('should use default WikiApi when wikiApi option is not provided', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logError('שגיאה');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה' });

    await decorated();

    expect(moduleMockApi.login).toHaveBeenCalledWith();
    expect(moduleMockApi.articleContent).toHaveBeenCalledWith('משתמש:Sapper-bot/לוג שגיאות');
  });

  it('should log to console when NODE_ENV is development', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    logger.logError('שגיאה');
    process.env.NODE_ENV = originalNodeEnv;

    expect(consoleLogSpy).toHaveBeenCalledWith('error: שגיאה');
  });

  it('should log info logs', async () => {
    const callback = jest.fn<() => Promise<void>>().mockImplementation(async () => {
      logger.logInfo('info');
    });
    const decorated = botLoggerDecorator(callback, { botName: 'בוט בדיקה', wikiApi: mockApi });

    await decorated();

    expect(mockApi.edit).toHaveBeenCalledTimes(1);

    const editCall = mockApi.edit.mock.calls[0];
    const content = editCall[2] as string;

    expect(content).toContain('===לוגים===');
    expect(content).toContain('info');
  });
});
