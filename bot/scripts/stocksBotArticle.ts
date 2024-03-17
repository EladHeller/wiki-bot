import 'dotenv/config';
import { getMarketValue } from '../API/mayaAPI';
import { promiseSequence } from '../utilities';
import {
  login, getMayaLinks, updateArticle,
} from '../wiki/wikiAPI';
import { WikiPage } from '../types';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';

async function main() {
  await login();
  console.log('Login success');

  const results = await getMayaLinks(true);
  const marketValues:{
    page: WikiPage,
    id: number,
  }[] = [];
  for (const page of Object.values(results)) {
    const res = await getMarketValue(page);
    if (res?.marketValue) {
      console.log(page.title);
      marketValues.push({
        page,
        id: res.id,
      });
    }
  }

  console.log('finnish get links', marketValues.length);

  await promiseSequence(10, marketValues.map(({ page, id }) => async () => {
    try {
      const content = page.revisions?.[0].slots.main['*'];
      if (!content) {
        throw new Error(`No content for page ${page.title}`);
      }
      console.log(page.title);
      const templateText = findTemplate(content, 'חברה מסחרית', page.title);
      const templateData = getTemplateKeyValueData(templateText);
      const marketCap = templateData['שווי'];
      const marketCapDate = templateData['תאריך שווי שוק'];
      if (!marketCap || !marketCapDate || !marketCap?.includes('שווי שוק חברה בורסאית')) {
        templateData['שווי'] = `{{שווי שוק חברה בורסאית|ID=${id}}}`;
        templateData['תאריך שווי שוק'] = '{{שווי שוק חברה בורסאית|ID=timestamp}}';
        const newContent = content.replace(templateText, templateFromKeyValueData(templateData, 'חברה מסחרית') + (templateText ? '' : '\n'));
        console.log(await updateArticle(page.title, 'הוספת תבנית שווי שוק חברה בורסאית', newContent));
        console.log(page.title, 'updated');
      }
    } catch (e) {
      console.error(page.title, e);
    }
  }));
}

main().catch(console.error);
