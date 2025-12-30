import { parseStringPromise } from 'xml2js';
import fs from 'fs';
import { findTemplates, getTemplateKeyValueData } from '../bot/wiki/newTemplateParser';

const templates = [
  "נושא משרה",
  "מנהיג"
]


type Page = {
  title?: string[];
  id?: string[];
  ns?: string[];
  redirect?: any;
  revision?: {
    id?: string[];
    parentid?: string[];
    timestamp?: string[];
    contributor?: {
      username?: string[];
      id?: string[];
    }[];
    comment?: string[];
    origin?: string[];
    model?: string[];
    format?: string[];
    text?: {
      _: string;
      $?: {
        bytes?: string;
        sha1?: string;
        'xml:space'?: string;
      };
    }[];
    sha1?: string[];
  }[];
};

console.debug = () => {};
async function main() {
  const outputFile = 'articles.txt';
  fs.writeFileSync(outputFile, '');
  const writeStream = fs.createWriteStream(outputFile, { flags: 'a' });
  
  for (let i = 0; i <= 18; i += 1) {
    const chunk = fs.readFileSync(`./data${i}.xml`, 'utf-8');
    const xml = await parseStringPromise(`<xml>${chunk}</xml>`);
    console.log('Processing chunk', i);
    xml.xml.page.forEach((page: Page) => {
      const text = page.revision?.[0]?.text?.[0]?._ || '';
      const title = page.title?.[0] || '';
      if (!text || !title) {
        return;
      }
      for (const templateName of templates) {
        const foundTemplates = findTemplates(text, templateName, title);
        for (const template of foundTemplates) {
          const keyValueData = getTemplateKeyValueData(template);
          if (keyValueData['סיווג']) {
            writeStream.write(title + '\n');
            return;
          }
        }
      }
    });
    console.log('chunk', i, 'done');
  }
  writeStream.end();
  console.log('Done! Articles saved to articles.txt');
}

main();