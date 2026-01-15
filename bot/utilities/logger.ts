import { AsyncLocalStorage } from 'async_hooks';

export type LogLevel = 'error' | 'warning' | 'info';

export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: Date;
};

export type BotLoggerContext = {
  botName: string;
  logs: LogEntry[];
  thrownError?: Error;
};

export const loggerAsyncLocalStorage = new AsyncLocalStorage<BotLoggerContext>();

export function stringify(message: any): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.stack || message.toString();
  }
  return JSON.stringify(message, null, 2);
}

const addLog = (level: LogLevel, message: any): void => {
  const context = loggerAsyncLocalStorage.getStore();
  const messageStr = stringify(message);
  if (context) {
    context.logs.push({
      level,
      message: messageStr,
      timestamp: new Date(),
    });
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`${level}: ${messageStr}`);
  }
};

export const logger = {
  logError: (message: any): void => addLog('error', message),
  logWarning: (message: any): void => addLog('warning', message),
  logInfo: (message: any): void => addLog('info', message),
};
