import botLoggerDecorator from '../decorators/botLoggerDecorator';
import { logger } from '../utilities/logger';

type SqsRecord = {
  messageId?: string;
  body?: string;
  attributes?: Record<string, string>;
  messageAttributes?: Record<string, unknown>;
  eventSourceARN?: string;
};

type SqsEvent = {
  Records?: SqsRecord[];
};

export default async function handleDlq(event: SqsEvent): Promise<void> {
  try {
    const records = event?.Records ?? [];
    if (!records.length) {
      logger.logInfo('DLQ event received with no records');
      return;
    }

    records.forEach((record, index) => {
      console.log(record);

      const resource = record?.eventSourceARN?.split?.(':')[1] ?? undefined;
      const errorMessage = record.messageAttributes?.ErrorMessage;

      logger.logError({
        source: 'lambda-dlq',
        index,
        messageId: record.messageId,
        resource,
        errorMessage,
      });
    });
  } catch (error) { // prevent endless loop
    logger.logError(error);
  }
}

export const main = botLoggerDecorator(handleDlq, { botName: 'DLQ' });
