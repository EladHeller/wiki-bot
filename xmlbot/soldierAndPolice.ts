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
const types = ['חייל', 'חיילת', 'שוטר', 'שוטרת'];
console.debug = () => {};
async function main() {
  let pagesCount = 0;
  const articles: Set<string> = new Set();
  for (let i = 0; i <= 18; i += 1) {
    const chunk = fs.readFileSync(`./data${i}.xml`, 'utf-8');
    const xml = await parseStringPromise(`<xml>${chunk}</xml>`);
    console.log('Processing chunk', i);
    xml.xml.page.forEach((page: Page) => {
      pagesCount += 1;
      let text = page.revision?.[0]?.text?.[0]?._ || '';
      const title = page.title?.[0] || '';
      if (!text || !title) {
        return;
      }
      for (const templateName of templates) {
        const templates = findTemplates(text, templateName, title);
        for (const template of templates) {
          const keyValueData = getTemplateKeyValueData(template);
          if (types.some((type) => keyValueData['סיווג']?.includes(type)) && !types.includes(keyValueData['סיווג'])) {
            articles.add(title);
          }
        }
      }
    });
    console.log('chunk', i, 'done');
  }
  await fs.promises.writeFile('articles.json', JSON.stringify(Array.from(articles), null, 2));
  console.log('Done! Articles saved to articles.json');
}

main();