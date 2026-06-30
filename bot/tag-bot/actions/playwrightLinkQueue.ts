import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { logger } from '../../utilities/logger';

export type PlaywrightLinkCheckRequestLink = {
  link: string;
  text: string;
};

export type PlaywrightLinkCheckQueueMessage = {
  title: string;
  commentSummary: string;
  commentId: string;
  links: PlaywrightLinkCheckRequestLink[];
};

const sqsClient = new SQSClient({});

export async function queuePlaywrightLinkCheck(message: PlaywrightLinkCheckQueueMessage): Promise<void> {
  const queueUrl = process.env.PLAYWRIGHT_CHECK_QUEUE_URL ?? '';
  if (!queueUrl) {
    throw new Error('Missing PLAYWRIGHT_CHECK_QUEUE_URL');
  }

  try {
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
    }));
  } catch (error) {
    logger.logError(error);
    throw error;
  }
}
