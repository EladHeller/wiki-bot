/* eslint-disable import/no-extraneous-dependencies */
import { Lambda } from 'aws-sdk';
import fs from 'fs/promises';

const region = 'us-west-2';
const lambda = new Lambda({ region });

async function main() {
  await lambda.updateFunctionCode({
    FunctionName: 'trade-boot',
    ZipFile: await fs.readFile('./dist.zip'),
  }).promise();
  await lambda.updateFunctionCode({
    FunctionName: 'send-email',
    ZipFile: await fs.readFile('./email.zip'),
  }).promise();
}

main().catch(console.error);
