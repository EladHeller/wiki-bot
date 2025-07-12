import fs from 'fs';

async function readLargeFile(path: string): Promise<number> {
  let i = 0;

  return new Promise<number>((resolve, reject) => {
    let data = '';
    const readStream = fs.createReadStream(path, 'utf-8');
    readStream.on('error', (error) => reject((error as Error).message));
    readStream.on('data', (chunk: string | Buffer<ArrayBufferLike>) => {
      try {
        data += chunk;
        if (data.length > 2e8) {
          const start = data.indexOf('<page>');
          const end = data.lastIndexOf('</page>') + 7;
          fs.writeFileSync(`./data${i}.xml`, data.slice(start, end));
          i += 1;
          data = data.slice(end);
        }
      } catch (error) {
        console.log(data.length);
        reject((error as Error).message);
      }
    });
    readStream.on('end', () => {
      const end = data.lastIndexOf('</page>') + 7;
      fs.writeFileSync(`./data${i}.xml`, data.slice(0, end));
      resolve(i);
    });
  });
}

readLargeFile('hewiki-latest-pages-articles.xml')
  .catch((error) => {
    console.error('Error reading large file:', error);
  }).then((result) => {
    console.log('File read successfully, chunks created:', result);
  });
