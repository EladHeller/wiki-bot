import 'dotenv/config';
import { getMarketValue } from '../mayaAPI';
import { promiseSequence } from '../utilities';
import {
  login, getMayaLinks, updateArticle,
} from '../wikiAPI';
import WikiTemplateParser from '../WikiTemplateParser';
import { WikiPage } from '../types';

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
      const content = page.revisions[0].slots.main['*'];
      console.log(page.title);
      const template = new WikiTemplateParser(content, 'חברה מסחרית');
      const { templateText } = template;
      const marketCap = template.templateData['שווי'];
      const marketCapDate = template.templateData['תאריך שווי שוק'];
      if (!marketCap || !marketCapDate || !marketCap?.includes('שווי שוק חברה בורסאית')) {
        template.templateData['שווי'] = `{{שווי שוק חברה בורסאית|ID=${id}}}`;
        template.templateData['תאריך שווי שוק'] = '{{שווי שוק חברה בורסאית|ID=timestamp}}';
        const newContent = content.replace(templateText, template.updateTamplateFromData() + (templateText ? '' : '\n'));
        console.log(await updateArticle(page.title, 'הוספת תבנית שווי שוק חברה בורסאית', newContent));
        console.log(page.title, 'updated');
      }
    } catch (e) {
      console.error(page.title, e);
    }
  }));
}

main().catch(console.error);
