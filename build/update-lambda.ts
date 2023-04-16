import { Lambda } from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
import 'dotenv/config';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const lambda = new Lambda({ region });

async function main() {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  await lambda.updateFunctionCode({
    FunctionName: 'Market-value-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }).promise();
  await lambda.updateFunctionCode({
    FunctionName: 'US-stocks-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }).promise();
  await lambda.updateFunctionCode({
    FunctionName: 'Kineret-level-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }).promise();
  await lambda.updateFunctionCode({
    FunctionName: 'purge-birthday-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }).promise();
  await lambda.updateFunctionCode({
    FunctionName: 'protect-templates-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }).promise();
  await lambda.updateFunctionCode({
    FunctionName: 'delete-redirects-function',
    S3Bucket: bucketCodeName,
    S3Key: 'dist.zip',
  }).promise();

  await lambda.updateFunctionCode({
    FunctionName: 'Send-email-function',
    S3Bucket: bucketCodeName,
    S3Key: 'email.zip',
  }).promise();
}

main().catch(console.error);
