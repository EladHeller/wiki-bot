import { readdirSync, readFileSync } from "node:fs";
import { parseStringPromise } from 'xml2js';

export type Page = {
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

export default async function runOnAllEntries(cb: (page: Page) => void) {
  const res = readdirSync('.');
  const dataFilesCount = res.filter(x => x.match(/^data\d+\.xml$/)).length;
  for (let i = 0; i < dataFilesCount; i += 1) {
    const chunk = readFileSync(`./data${i}.xml`, 'utf-8');
    const xml = await parseStringPromise(`<xml>${chunk}</xml>`);
    for (const page of xml.xml.page) {
      let newText = page.revision?.[0]?.text?.[0]?._ || '';
      const title = page.title?.[0] || '';
      if (newText && title) {
        cb(page satisfies Page);
      }
    }
  }
}