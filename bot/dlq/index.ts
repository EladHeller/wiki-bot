import botLoggerDecorator from '../decorators/botLoggerDecorator';
import { logger } from '../utilities/logger';

type SqsRecord = {
  messageId?: string;
  body?: string;
  attributes?: Record<string, string>;
  messageAttributes?: Record<string, unknown>;
};

type SqsEvent = {
  Records?: SqsRecord[];
};

export default async function handleDlq(event: SqsEvent): Promise<void> {
  const records = event?.Records ?? [];
  if (!records.length) {
    logger.logInfo('DLQ event received with no records');
    return;
  }

  records.forEach((record, index) => {
    console.log(record);
    let parsedBody: unknown = record.body;
    if (record.body) {
      try {
        parsedBody = JSON.parse(record.body);
      } catch {
        parsedBody = record.body;
      }
    }

    const body = parsedBody as {
      resources?: string;
    };

    const resource = body?.resources?.split?.('/')[1] ?? undefined;
    const errorMessage = record.messageAttributes?.ErrorMessage;

    logger.logError({
      source: 'lambda-dlq',
      index,
      messageId: record.messageId,
      resource,
      errorMessage,
    });
  });
}

export const main = botLoggerDecorator(handleDlq, { botName: 'DLQ' });
