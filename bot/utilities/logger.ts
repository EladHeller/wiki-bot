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

const addLog = (level: LogLevel, message: string): void => {
  const context = loggerAsyncLocalStorage.getStore();
  if (context) {
    context.logs.push({
      level,
      message,
      timestamp: new Date(),
    });
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`${level}: ${message}`);
  }
};

export const logger = {
  logError: (message: string): void => addLog('error', message),
  logWarning: (message: string): void => addLog('warning', message),
  logInfo: (message: string): void => addLog('info', message),
};
