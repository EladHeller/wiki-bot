import { S3 } from 'aws-sdk'; // eslint-disable-line import/no-extraneous-dependencies
import 'dotenv/config';
import fs from 'fs/promises';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const s3 = new S3({ region });

async function main() {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }
  await s3.upload({
    Bucket: bucketCodeName,
    Key: 'dist.zip',
    Body: await fs.readFile('./dist.zip'),
  }).promise();
  console.log('first file uploaded');
  await s3.upload({
    Bucket: bucketCodeName,
    Key: 'email.zip',
    Body: await fs.readFile('./email.zip'),
  }).promise();
  console.log('second file uploaded');
}

main().catch(console.error);
