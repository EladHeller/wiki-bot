/* eslint-disable no-loop-func */
const { parseStringPromise } = require('xml2js');
const fs = require('fs');

const chunks = [];

function readLargeFile(path) {
  let i = 0;
  return new Promise((resolve, reject) => {
    let data = '';
    const readStream = fs.createReadStream(path, 'utf-8');
    readStream.on('error', (error) => reject(error.message));
    readStream.on('data', (chunk) => {
      try {
        data += chunk;
        if (data.length > 3e8) {
          const start = data.indexOf('<page>');
          const end = data.lastIndexOf('</page>') + 7;
          chunks.push(data.slice(start, end));
          fs.writeFileSync(`./data${i}.xml`, data.slice(start, end));
          i += 1;
          data = data.slice(end);
        }
      } catch (error) {
        console.log(data.length);
        reject(error.message);
      }
    });
    readStream.on('end', () => {
      const end = data.lastIndexOf('</page>') + 7;
      chunks.push(data.slice(0, end));
      fs.writeFileSync(`./data${i}.xml`, data.slice(0, end));
      resolve(i);
    });
  });
}

async function main() {
  try {
    await readLargeFile('hewiki-latest-pages-articles.xml');
  } catch {
    throw new Error('Failed to read file.');
  }
  let botEdits = 0;
  let userEdits = 0;
  for (let i = 0; i <= 11; i += 1) {
    const chunk = fs.readFileSync(`./data${i}.xml`, 'utf-8');
    const xml = await parseStringPromise(`<xml>${chunk}</xml>`);
    xml.xml.page.forEach((page) => {
      if (page.revision?.[0]?.contributor?.[0]?.username?.[0] === 'Sapper-bot') {
        botEdits += 1;
      } else if (page.revision?.[0]?.contributor?.[0]?.username?.[0] === 'החבלן') {
        userEdits += 1;
      }
    });
    console.log('chunk', i, 'done');
  }
  console.log({ botEdits, userEdits });
}

main();
