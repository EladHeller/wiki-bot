import { S3, HeadObjectCommandOutput } from '@aws-sdk/client-s3'; // eslint-disable-line import/no-extraneous-dependencies
import fs from 'fs/promises';
import crypto from 'crypto';

const chunk = 1024 * 1024 * 16; // 16MB

const md5 = (data: Buffer) => crypto.createHash('md5').update(data).digest('hex');

async function getEtagOfFile(stream: Buffer) {
  if (stream.length <= chunk) {
    return md5(stream);
  }
  const md5Chunks: string[] = [];
  const chunksNumber = Math.ceil(stream.length / chunk);
  for (let i = 0; i < chunksNumber; i += 1) {
    const chunkStream = Uint8Array.prototype.slice.call(stream, i * chunk, (i + 1) * chunk);
    md5Chunks.push(md5(Buffer.from(chunkStream)));
  }

  return `${md5(Buffer.from(md5Chunks.join(''), 'hex'))}-${chunksNumber}`;
}

async function upload(s3: S3, bucket: string, key: string, filePath: string): Promise<string | undefined> {
  let s3Object: HeadObjectCommandOutput | Partial<HeadObjectCommandOutput> = {};
  try {
    s3Object = await s3.headObject({
      Bucket: bucket,
      Key: key,
    });
  } catch (e: any) {
    if (e.name !== 'NotFound') {
      console.log('headObject Error:', e);
    }
  }

  const file = await fs.readFile(filePath);
  console.log(file.length, s3Object.ContentLength);
  const etag = await getEtagOfFile(file);
  console.log(etag, JSON.parse(s3Object.ETag || '""'));
  if (s3Object.ETag && etag === JSON.parse(s3Object.ETag)) {
    console.log(`${key} already up to date`);
    return s3Object.VersionId;
  }

  const res = await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: file,
  });
  console.log({ res });
  console.log(`${key} updated`);
  return res.VersionId;
}

export default async function updateS3(
  bucketCodeName: string = process.env.CODE_BUCKET as string,
  region: string = process.env.REGION as string,
) {
  if (!bucketCodeName) {
    throw new Error('Bucket code variable is empty!');
  }

  const s3 = new S3({ region });
  const distVersion = await upload(s3, bucketCodeName, 'dist.zip', './dist.zip');
  return { distVersion };
}
