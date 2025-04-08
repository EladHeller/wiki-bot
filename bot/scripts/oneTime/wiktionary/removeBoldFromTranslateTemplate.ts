/**
 * יש 214 מופעים של תרגום בהגדשה. ניתן לזהות אותם לפי הביטוי הרגולרי /'''\{\{ת\|/. האם יש אפשרות להסיר בעזרת בוט את ההדגשה בלבד (ולא את התרגום עצמו)?
 */

import { asyncGeneratorMapWithSequence } from '../../../utilities';
import BaseWikiApi, { defaultConfig } from '../../../wiki/BaseWikiApi';
import WikiApi from '../../../wiki/WikiApi';

const templateName = 'ת';
const regex = /'''\s*({{ת\s*\|[^}]+}})\s*'''/g;

export default async function removeBoldFromTranslateTemplate() {
  const api = WikiApi(BaseWikiApi({
    ...defaultConfig,
    baseUrl: 'https://he.wiktionary.org/w/api.php',
  }));
  await api.login();
  const generator = api.getArticlesWithTemplate(templateName);
  let pagesCount = 0;
  let editedCount = 0;
  await asyncGeneratorMapWithSequence(50, generator, (page) => async () => {
    pagesCount += 1;
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!content || !revid) {
      throw new Error('Failed to get content or revid');
    }
    const newContent = content.replace(regex, '$1');
    if (newContent !== content) {
      console.log('Updating', page.title);
      editedCount += 1;
      await api.edit(page.title, 'הסרת הדגשה מתבנית:ת', newContent, revid);
    }
  });
  console.log(`Total pages: ${pagesCount}`);
  console.log(`Edited pages: ${editedCount}`);
}
