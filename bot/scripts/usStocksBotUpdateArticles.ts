/* eslint-disable no-loop-func */
import 'dotenv/config';
import fs from 'fs/promises';
import { getCompanyData, googleFinanceRegex } from '../API/googleFinanceApi';
import { promiseSequence } from '../utilities';
import { WikiPage } from '../types';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import WikiApi from '../wiki/WikiApi';
import { getGoogleFinanceLinksWithContent } from '../wiki/SharedWikiApiFunctions';

async function main() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');

  let dataPages: WikiPage[] = [];

  try {
    dataPages = JSON.parse(await fs.readFile('res.json', 'utf-8'));
  } catch {
    console.warn('res.json not exists');
  }

  if (!dataPages.length) {
    const results = await getGoogleFinanceLinksWithContent(api);
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
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!content || !revid) {
      throw new Error(`No content or revid for page ${page.title}`);
    }
    const templateText = findTemplate(content, 'חברה מסחרית', page.title);
    if (!templateText) {
      console.log(page.title, 'not template');
    }
    const templateData = getTemplateKeyValueData(templateText);
    const marketCap = templateData['שווי'];
    const marketCapDate = templateData['תאריך שווי שוק'];
    if (templateText && (!marketCap || !marketCapDate || !marketCap?.includes('שווי שוק חברה בורסאית'))) {
      templateData['שווי'] = `{{שווי שוק חברה בורסאית (ארצות הברית)|ID=${tiker}}}`;
      templateData['תאריך שווי שוק'] = '{{שווי שוק חברה בורסאית (ארצות הברית)|ID=timestamp}}';
      const newContent = content.replace(templateText, templateFromKeyValueData(templateData, 'חברה מסחרית'));
      console.log(await api.edit(page.title, 'שווי שוק', newContent, revid));
    }
  }));
}

main().catch((e) => {
  console.error(e);
});
