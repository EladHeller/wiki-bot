import 'dotenv/config';
import {
  login, externalUrl,
} from '../wiki/wikiAPI';
// import { promiseSequence } from '../utilities';
// import { findTemplates } from '../wiki/newTemplateParser';

const oldLink = 'www.ynet.co.il/articles';
export default async function ynet() {
  await login();
  const pages = await externalUrl(oldLink);

  for (const page of pages) {
    const content = page.revisions?.[0].slots.main['*'];
    if (!content || !page.title) {
      console.log('no content', page.title);
    } else {
      console.log(page.title);
    }
    // const refTemplates = findTemplates(content, 'הערה', page.title);
    // refTemplates.forEach((refTemplate) => {
    //   if (refTemplate.includes(oldLink)) {
    //     console.log(page.title, refTemplate);
    //   }
    // });
  }
}
