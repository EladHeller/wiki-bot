import zlib from 'zlib';

export default function parseLogs(data) {
  const res = zlib.unzipSync(Buffer.from(data, 'base64')).toString();
  return JSON.parse(res);
}
