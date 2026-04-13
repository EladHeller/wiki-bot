import WikiApi from '../../wiki/WikiApi';
import WikidataAPI from '../../wiki/WikidataAPI';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { asyncGeneratorMapWithSequence } from '../../utilities';

const THEATER_GUIDE_TEMPLATE = 'מדריך לתיאטרון';
const FILMMAKER_PROFILES_TEMPLATE = 'פרופילי קולנוענים-מוזיקאים';
const THEATER_GUIDE_PROPERTY = 'P10391';

export default async function removeTheaterGuide() {
  const api = WikiApi();
  const wikidataApi = WikidataAPI();
  await api.login();
  await wikidataApi.login();

  const generator = api.getArticlesWithTemplate(THEATER_GUIDE_TEMPLATE);

  let count = 0;

  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    const filmmakerTemplates = content ? findTemplates(content, FILMMAKER_PROFILES_TEMPLATE, page.title) : [];

    if (!content || !revid || filmmakerTemplates.length === 0) {
      console.log({ hasContent: !!content, hasRevid: !!revid, hasTemplate: !!filmmakerTemplates.length }, page.title);
      return;
    }
    try {
      const qid = await api.getWikiDataItem(page.title);
      if (!qid) {
        console.log('No qid', page.title);
        return;
      }
      const entity = await wikidataApi.getClaim(qid, THEATER_GUIDE_PROPERTY);
      const theatherGuideId = entity?.[0]?.mainsnak.datavalue.value;
      if (!theatherGuideId) {
        console.log('No theatherGuideId', page.title);
        return;
      }
      const templates = findTemplates(content, THEATER_GUIDE_TEMPLATE, page.title);
      let newContent = content;
      for (const template of templates) {
        const arrayData = getTemplateArrayData(template, THEATER_GUIDE_TEMPLATE, page.title);
        if (arrayData[0] === theatherGuideId) {
          newContent = newContent.replace(`*${template}\n`, '');
          newContent = newContent.replace(`* ${template}\n`, '');
          newContent = newContent.replace(`*ֿ\t${template}\n`, '');
        }
      }

      if (newContent !== content) {
        console.log(`[${page.title}] Removing ${THEATER_GUIDE_TEMPLATE}`);
        await api.edit(
          page.title,
          `הסרת {{${THEATER_GUIDE_TEMPLATE}}} (מוכללת ב{{${FILMMAKER_PROFILES_TEMPLATE}}}) ([[מיוחד:הבדל/43074245|בקשה בוק:בב]])`,
          newContent,
          revid,
        );
        count += 1;
      } else {
        console.log('No change', page.title);
      }
    } catch (error) {
      console.error(`[${page.title}] Error:`, error);
    }
  });

  console.log(`Finished. Total removed: ${count}`);
}
