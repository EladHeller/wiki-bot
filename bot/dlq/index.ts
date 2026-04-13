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
    let parsedBody: unknown = record.body;
    if (record.body) {
      try {
        parsedBody = JSON.parse(record.body);
      } catch {
        parsedBody = record.body;
      }
    }

    logger.logError({
      source: 'lambda-dlq',
      index,
      messageId: record.messageId,
      body: parsedBody,
      attributes: record.attributes,
      messageAttributes: record.messageAttributes,
    });
  });
}

export const main = botLoggerDecorator(handleDlq, { botName: 'DLQ' });
