const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const zlib = require('zlib');

AWS.config.region = 'us-west-2';
const ses = new AWS.SES({ apiVersion: '2010-12-01' });

function sendMail(to, subject, html) {
  const params = {
    Destination: {
      ToAddresses: to,
    },
    Message: {
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },
      },
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
    },
    Source: 'Trade Bot <eladheller@gmail.com>',
  };
  return ses.sendEmail(params).promise();
}

const cloudWatchLink = 'https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#logsV2:log-groups/log-group/$252Faws$252Flambda$252Ftrade-boot';

exports.handler = async (event) => {
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
};
