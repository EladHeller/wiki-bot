/* eslint-disable no-loop-func */
import 'dotenv/config';
import fs from 'fs/promises';
import { getCompanyData, googleFinanceRegex } from '../API/googleFinanceApi';
import { promiseSequence } from '../utilities';
import {
  getGoogleFinanceLinksWithContent, login, updateArticle,
} from '../wiki/wikiAPI';
import WikiTemplateParser from '../wiki/WikiTemplateParser';
import { WikiPage } from '../types';

async function main() {
  await login();
  console.log('Login success');

  let dataPages: WikiPage[] = [];

  try {
    dataPages = JSON.parse(await fs.readFile('res.json', 'utf-8'));
  } catch {
    console.warn('res.json not exists');
  }

  if (!dataPages.length) {
    const results = await getGoogleFinanceLinksWithContent();
    console.log('links', Object.keys(results).length);
    const pages = Object.values(results);

    await promiseSequence(10, pages.map((page) => async () => {
      const data = await getCompanyData(page);
      if (data) {
        dataPages.push(data.wiki);
      }
    }));

    await fs.writeFile('res.json', JSON.stringify(dataPages));
  }

  await promiseSequence(10, dataPages.map((page) => async () => {
    const extLink = page.extlinks?.find((link) => link['*'].match(googleFinanceRegex))?.['*'];
    const tiker = extLink?.split('?q=')[1];
    if (!extLink || !extLink) {
      console.log(page.title, { extLink, tiker });
      return;
    }
    const content = page.revisions[0].slots.main['*'];
    const template = new WikiTemplateParser(content, 'חברה מסחרית');
    if (!template) {
      console.log(page.title, 'not template');
    }
    const marketCap = template.templateData['שווי'];
    const marketCapDate = template.templateData['תאריך שווי שוק'];
    const { templateText } = template;
    if (templateText && (!marketCap || !marketCapDate || !marketCap?.includes('שווי שוק חברה בורסאית'))) {
      template.templateData['שווי'] = `{{שווי שוק חברה בורסאית (ארצות הברית)|ID=${tiker}}}`;
      template.templateData['תאריך שווי שוק'] = '{{שווי שוק חברה בורסאית (ארצות הברית)|ID=timestamp}}';
      const newContent = content.replace(templateText, template.updateTamplateFromData());
      console.log(await updateArticle(page.title, 'שווי שוק', newContent));
    }
  }));
}

main().catch((e) => {
  console.error(e);
});
