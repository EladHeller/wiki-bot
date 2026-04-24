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

type ParsedBody = {
  version?: string,
  id?: string,
  'detail-type'?: string,
  source?: string,
  account?: string,
  region?: string,
  resources?: string[],
  detail?: object
}

export default async function handleDlq(event: SqsEvent): Promise<void> {
  try {
    const records = event?.Records ?? [];
    if (!records.length) {
      logger.logInfo('DLQ event received with no records');
      return;
    }

    records.forEach((record, index) => {
      console.log(record);
      let resource;
      const { body } = record;
      if (body && typeof body === 'string') {
        try {
          const parsedBody: ParsedBody = JSON.parse(body);
          resource = parsedBody.resources?.map((r) => r.split('/').at(-1)).join(', ');
        } catch {
          console.error(`Could not parse body: ${body}`);
        }
      }
      const errorMessage = record.messageAttributes?.ErrorMessage;

      logger.logError({
        index,
        messageId: record.messageId,
        resource: resource ?? 'No-resource',
        errorMessage,
      });
    });
  } catch (error) { // prevent endless loop
    logger.logError(error);
  }
}

export const main = botLoggerDecorator(handleDlq, { botName: 'DLQ' });
