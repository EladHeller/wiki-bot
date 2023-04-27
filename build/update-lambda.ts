import { LambdaClient, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda'; // eslint-disable-line import/no-extraneous-dependencies
import 'dotenv/config';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const lambda = new LambdaClient({ region });

async function main() {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'Market-value-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }));
  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'US-stocks-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }));
  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'Kineret-level-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }));
  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'purge-birthday-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }));
  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'protect-templates-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }));
  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'delete-redirects-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }));

  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: 'Send-email-function',
    S3Bucket: bucketCodeName,
    S3Key: 'email.zip',
  }));
}

main().catch(console.error);
