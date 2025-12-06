import { parseStringPromise } from 'xml2js';
import fs from 'fs';
import { findTemplates, getTemplateArrayData } from '../bot/wiki/newTemplateParser';

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


  async function main() {
    const articles: string[] = [];
    for (let i = 0; i <= 17; i += 1) {
      const chunk = fs.readFileSync(`./data${i}.xml`, 'utf-8');
      const xml = await parseStringPromise(`<xml>${chunk}</xml>`);
      console.log('Processing chunk', i);
      xml.xml.page.forEach((page: Page) => {
        let text = page.revision?.[0]?.text?.[0]?._ || '';
        const title = page.title?.[0] || '';
        if (!text || !title) {
          return;
        }
      });
    console.log('chunk', i, 'done');
  }
}

main();