import { S3 } from '@aws-sdk/client-s3'; // eslint-disable-line import/no-extraneous-dependencies
import 'dotenv/config';
import fs from 'fs/promises';
import crypto from 'crypto';

const region = process.env.REGION;
const bucketCodeName = process.env.CODE_BUCKET;

const s3 = new S3({ region });

const chunk = 1024 * 1024 * 5; // 5MB

const md5 = (data: Buffer) => crypto.createHash('md5').update(data).digest('hex');

async function getEtagOfFile(stream: Buffer) {
  if (stream.length <= chunk) {
    return md5(stream);
  }
  const md5Chunks: string[] = [];
  const chunksNumber = Math.ceil(stream.length / chunk);
  for (let i = 0; i < chunksNumber; i += 1) {
    const chunkStream = stream.slice(i * chunk, (i + 1) * chunk);
    md5Chunks.push(md5(chunkStream));
  }

  return `${md5(Buffer.from(md5Chunks.join(''), 'hex'))}-${chunksNumber}`;
}

async function upload(bucket: string, key: string, filePath: string) {
  const s3Object = await s3.headObject({
    Bucket: bucket,
    Key: key,
  });
  const file = await fs.readFile(filePath);
  console.log(file.length, s3Object.ContentLength);
  const etag = await getEtagOfFile(file);
  console.log(etag, s3Object.ETag);
  if (etag === JSON.parse(s3Object.ETag ?? '""')) {
    console.log(`${key} already up to date`);
    return;
  }

  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: file,
  });
  console.log(`${key} updated`);
}

async function main() {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  await upload(bucketCodeName, 'dist.zip', './dist.zip');
  await upload(bucketCodeName, 'email.zip', './email.zip');
}

main().catch(console.error);
