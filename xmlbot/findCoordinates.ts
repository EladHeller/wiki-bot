import { parseStringPromise } from 'xml2js';
import fs from 'fs';
import { findTemplates, getTemplateKeyValueData } from '../bot/wiki/newTemplateParser';

const coordinateTemplateName = 'coord'
const map = new Map<string, Set<string>>();
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
  for (let i = 0; i <= 18; i += 1) {
    const chunk = fs.readFileSync(`./data${i}.xml`, 'utf-8');
    const xml = await parseStringPromise(`<xml>${chunk}</xml>`);
    console.log('Processing chunk', i);
    xml.xml.page.forEach((page: Page) => {
      const text = page.revision?.[0]?.text?.[0]?._ || '';
      const title = page.title?.[0] || '';
      if (!text || !title || !text.includes(`{{${coordinateTemplateName}`)) {
        return;
      }
      const templates = findTemplates(text, coordinateTemplateName, title);
      for (const template of templates) {
        const existingTitles = map.get(template) || new Set();
        existingTitles.add(title);
        map.set(template, existingTitles);
      }
    });
    console.log('chunk', i, 'done');
  }

  fs.writeFileSync('coordinates.json', JSON.stringify(Array.from(map.entries()).map(([template, titles]) => ({ template, titles: Array.from(titles) })), null, 2));
  console.log('Done! Coordinates saved to coordinates.json');
}

main();