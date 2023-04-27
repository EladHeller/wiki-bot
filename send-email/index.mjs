/* eslint-disable import/no-extraneous-dependencies, import/prefer-default-export */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import parseLogs from './parseLog.mjs';

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

const baseCloudWatchLink = 'https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/';

export async function handler(event) {
  console.log('Received event:', JSON.stringify(event), 'upload success');
  let log;
  if (event.awslogs && event.awslogs.data) {
    try {
      log = parseLogs(event.awslogs.data);
    } catch (e) {
      console.log(e);
    }
  }
  let cloudWatchLink = baseCloudWatchLink;
  if (log && log.logGroup) {
    cloudWatchLink += `${log.logGroup.replace(/\//g, '$252F')}/log-events/`;
    if (log.logStream) {
      cloudWatchLink += `${log.logStream.replace(/\//g, '$252F')}`;
    }
  }

  await sendMail(
    ['eladheller@gmail.com'],
    'Bot run failed',
    `<p dir="ltr">More details in ${cloudWatchLink}.</p>
    ${log ? `<pre dir="ltr">${JSON.stringify(log.logEvents, null, 2)}</pre>` : ''}`,
  );
}
