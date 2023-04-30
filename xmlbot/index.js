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
  // await readLargeFile('hewiki-20230420-pages-articles.xml');

  for (let i = 0; i <= 9; i += 1) {
    const chunk = fs.readFileSync(`./data${i}.xml`, 'utf-8');
    const xml = await parseStringPromise(`<xml>${chunk}</xml>`);
    console.log(xml.xml.page[0]);
  }

  console.log('success');
}

main();
