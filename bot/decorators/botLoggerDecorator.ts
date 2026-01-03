import { AsyncLocalStorage } from 'node:async_hooks';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import { getLocalTimeAndDate } from '../utilities';
import shabathProtectorDecorator from './shabathProtector';

const BOT_LOG_PAGE = 'משתמש:Sapper-bot/לוג שגיאות';

type LogLevel = 'error' | 'warning';

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: Date;
};

type BotLoggerContext = {
  botName: string;
  logs: LogEntry[];
  thrownError?: Error;
};

const asyncLocalStorage = new AsyncLocalStorage<BotLoggerContext>();

const addLog = (level: LogLevel, message: string): void => {
  const context = asyncLocalStorage.getStore();
  if (context) {
    context.logs.push({
      level,
      message,
      timestamp: new Date(),
    });
  }
};

export const logError = (message: string): void => addLog('error', message);
export const logWarning = (message: string): void => addLog('warning', message);

const findNextHeadingNumber = (content: string, baseHeading: string): number => {
  const escapedHeading = baseHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(`^==${escapedHeading}(?: \\((\\d+)\\))?==`, 'gm');

  let maxNumber = 0;
  let match = headingPattern.exec(content);
  while (match) {
    const num = match[1] ? parseInt(match[1], 10) : 1;
    maxNumber = Math.max(maxNumber, num);
    match = headingPattern.exec(content);
  }

  return maxNumber > 0 ? maxNumber + 1 : 0;
};

const formatLogContent = (context: BotLoggerContext): string => {
  const { logs, thrownError } = context;

  const errors = logs.filter((log) => log.level === 'error');
  const warnings = logs.filter((log) => log.level === 'warning');

  const lines: string[] = [];

  if (thrownError) {
    lines.push('===שגיאה שנזרקה===');
    lines.push(`<code>${thrownError.message}</code>`);
    lines.push('');
  }

  if (errors.length > 0) {
    lines.push('===שגיאות===');
    errors.forEach((log) => {
      lines.push(`* ${log.message}`);
    });
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('===אזהרות===');
    warnings.forEach((log) => {
      lines.push(`* ${log.message}`);
    });
    lines.push('');
  }

  return lines.join('\n');
};

const writeLogsToWiki = async (
  api: IWikiApi,
  context: BotLoggerContext,
): Promise<void> => {
  const { logs, thrownError, botName } = context;

  if (logs.length === 0 && !thrownError) {
    return;
  }

  const { content: pageContent, revid } = await api.articleContent(BOT_LOG_PAGE);

  const dateString = getLocalTimeAndDate(new Date().toISOString());
  const baseHeading = `${botName} - ${dateString}`;
  const headingNumber = findNextHeadingNumber(pageContent, baseHeading);
  const heading = headingNumber > 0 ? `${baseHeading} (${headingNumber})` : baseHeading;

  const logContent = formatLogContent(context);
  const newContent = `${pageContent}\n==${heading}==\n${logContent}~~~~\n`;

  await api.edit(
    BOT_LOG_PAGE,
    `לוג ריצה: ${botName}`,
    newContent,
    revid,
  );
};

type BotLoggerOptions = {
  botName: string;
  wikiApi?: IWikiApi; // For testing
};

export default function botLoggerDecorator<T>(
  cb: (...args: any[]) => Promise<T>,
  options: BotLoggerOptions,
) {
  const wrappedWithShabath = shabathProtectorDecorator(async (...args: any[]): Promise<T | undefined> => {
    const context: BotLoggerContext = {
      botName: options.botName,
      logs: [],
    };

    return asyncLocalStorage.run(context, async () => {
      const api = options.wikiApi ?? WikiApi();
      await api.login();

      try {
        const result = await cb(...args);
        return result;
      } catch (error) {
        if (error instanceof Error) {
          context.thrownError = error;
        } else {
          context.thrownError = new Error(String(error));
        }
        throw error;
      } finally {
        try {
          await writeLogsToWiki(api, context);
        } catch (writeError) {
          console.error('Failed to write logs to wiki:', writeError);
        }
      }
    });
  });

  return wrappedWithShabath;
}
