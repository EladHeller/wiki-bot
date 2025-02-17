import 'dotenv/config';
import { getMarketValue } from '../API/mayaAPI';
import { promiseSequence } from '../utilities';
import { WikiPage } from '../types';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import WikiApi from '../wiki/WikiApi';
import { getMayaLinks } from '../wiki/SharedWikiApiFunctions';

async function main() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');

  const results = await getMayaLinks(api, true);
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
      const revid = page.revisions?.[0].revid;
      if (!content || !revid) {
        throw new Error(`No content or no revid for page ${page.title}`);
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
        console.log(await api.edit(page.title, 'הוספת תבנית שווי שוק חברה בורסאית', newContent, revid));
        console.log(page.title, 'updated');
      }
    } catch (e) {
      console.error(page.title, e);
    }
  }));
}

main().catch(console.error);
