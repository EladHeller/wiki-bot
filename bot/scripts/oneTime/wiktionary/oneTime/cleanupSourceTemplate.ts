/**
 * יש 180 מופעים של הביטוי הרגולרי /\{\{שרש3\|ש\|ר\|ש\}\}/, כולם שגויים (להבדיל מכמה מופעים לא שגויים של /\{\{שרש3\|שׁ\|ר\|שׁ\}\}/ – ה־ש עם ניקוד). תוכל בבקשה להסיר מופעים אלה בעזרת הבוט?
 */

import { asyncGeneratorMapWithSequence } from '../../../../utilities';
import BaseWikiApi, { defaultConfig } from '../../../../wiki/BaseWikiApi';
import WikiApi from '../../../../wiki/WikiApi';

const templateName = 'שרש3';
const regexToRemove = /\{\{שרש3\|ש\|ר\|ש\}\}/g;

export default async function cleanupSourceTemplate() {
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
    const newContent = content.replace(regexToRemove, '');
    if (newContent !== content) {
      console.log('Updating', page.title);
      editedCount += 1;
      await api.edit(page.title, 'הסרת תבנית שרש3 שגויה', newContent, revid);
    }
  });
  console.log(`Total pages: ${pagesCount}`);
  console.log(`Edited pages: ${editedCount}`);
}
