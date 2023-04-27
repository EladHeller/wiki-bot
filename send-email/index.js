/* eslint-disable import/no-extraneous-dependencies, import/prefer-default-export */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import zlib from 'zlib';

const region = process.env.REGION;
const ses = new SESClient({ region });

function sendMail(to, subject, html) {
  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: to,
    },
    Message: {
      Body: {
        Html: { Charset: 'UTF-8', Data: html },
      },
      Subject: { Charset: 'UTF-8', Data: subject },
    },
    Source: 'Sapper-Bot <eladheller@gmail.com>',
  });

  return ses.send(command);
}

const cloudWatchLink = 'https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252FMarket-value-function';

export async function handler(event, ...args) {
  console.log('Received event:', JSON.stringify(event), JSON.stringify(args));
  let logevents;
  if (event.awslogs && event.awslogs.data) {
    try {
      const payload = Buffer.from(
        event.awslogs.data,
        'base64',
      );

      logevents = JSON.parse(zlib.unzipSync(payload).toString()).logEvents;
    } catch (e) {
      console.log(e);
    }
  }

  await sendMail(
    ['eladheller@gmail.com'],
    'Bot run failed',
    `<p dir="ltr">More details in ${cloudWatchLink}.</p>
    ${logevents ? `<pre dir="ltr">${JSON.stringify(logevents, null, 2)}</pre>` : ''}`,
  );
}
