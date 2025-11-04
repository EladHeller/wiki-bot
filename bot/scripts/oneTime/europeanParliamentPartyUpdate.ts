import WikiApi from '../../wiki/WikiApi';
import WikiDataAPI, { IWikiDataAPI } from '../../wiki/WikidataAPI';
import { promiseSequence } from '../../utilities';
import {
  findTemplate,
  findTemplates,
  getTemplateKeyValueData,
  templateFromKeyValueData,
  getTemplateArrayData,
} from '../../wiki/newTemplateParser';

const TEMPLATE_NAME = 'מפלגה';
const EUROPEAN_PARLIAMENT_TEXT = 'הפרלמנט האירופי';
const COUNTRY_PROPERTY = 'P17';

function extractCountryName(countryValue: string, title: string): string | null {
  if (!countryValue) return null;

  const flagTemplate = findTemplate(countryValue, 'דגל', title);
  if (flagTemplate) {
    const flagParams = getTemplateArrayData(flagTemplate, 'דגל', title);
    return flagParams[0] || null;
  }

  return countryValue
    .replace(/\[\[([^|\]]+)(\|[^\]]+)?\]\]/g, '$1')
    .trim() || null;
}

function findEuropeanParliamentIndex(keyValueData: Record<string, string>): number | null {
  const entry = Object.entries(keyValueData).find(([key, value]) => {
    const match = key.match(/^שם נציגות(\d+)$/);
    return match && value.includes(EUROPEAN_PARLIAMENT_TEXT);
  });

  if (!entry) return null;
  const match = entry[0].match(/^שם נציגות(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function updateTemplate(
  template: string,
  countryName: string,
  x: number,
): string {
  const keyValueData = getTemplateKeyValueData(template);
  return templateFromKeyValueData({
    ...keyValueData,
    [`שם נציגות${x}`]: `[[${EUROPEAN_PARLIAMENT_TEXT}]]`,
    [`מספר מושבים${x}`]: '720',
    [`הערה${x}`]: `{{מפלגה/מדינה בפרלמנט האירופי|${countryName}}}`,
  }, TEMPLATE_NAME);
}

async function getCountryFromWikidata(
  api: ReturnType<typeof WikiApi>,
  wikiDataApi: IWikiDataAPI,
  title: string,
): Promise<string | null> {
  try {
    const wikiDataItem = await api.getWikiDataItem(title);
    if (!wikiDataItem) return null;

    const countryClaims = await wikiDataApi.getClaim(wikiDataItem, COUNTRY_PROPERTY);
    const countryQid = countryClaims[0]?.mainsnak?.datavalue?.value?.id;
    if (!countryQid) return null;

    const countryEntity = await wikiDataApi.readEntity(countryQid, 'labels', 'he');
    return countryEntity.labels?.he?.value || null;
  } catch {
    return null;
  }
}

async function processTemplate(
  template: string,
  title: string,
  api: ReturnType<typeof WikiApi>,
  wikiDataApi: IWikiDataAPI,
): Promise<string | null> {
  const keyValueData = getTemplateKeyValueData(template);
  let countryValue: string | null = keyValueData['מדינה'] || null;

  if (!countryValue) {
    countryValue = await getCountryFromWikidata(api, wikiDataApi, title);
    if (!countryValue) return null;
  }

  const countryName = extractCountryName(countryValue, title);
  if (!countryName) return null;

  const x = findEuropeanParliamentIndex(keyValueData);
  if (x == null) return null;

  return updateTemplate(template, countryName, x);
}

async function processArticle(
  api: ReturnType<typeof WikiApi>,
  wikiDataApi: IWikiDataAPI,
  title: string,
): Promise<void> {
  try {
    const { content: originalContent, revid } = await api.articleContent(title);
    const templates = findTemplates(originalContent, TEMPLATE_NAME, title);

    if (templates.length === 0) {
      console.log(`No ${TEMPLATE_NAME} template found in ${title}`);
      return;
    }

    let updatedContent = originalContent;
    for (const template of templates) {
      const updatedTemplate = await processTemplate(template, title, api, wikiDataApi);
      if (updatedTemplate) {
        updatedContent = updatedContent.replace(template, updatedTemplate);
      }
    }

    if (updatedContent !== originalContent) {
      await api.edit(title, 'עדכון פרמטרים של הפרלמנט האירופי בתבנית מפלגה', updatedContent, revid);
      console.log(`✅ Updated: ${title}`);
    } else {
      console.log(`❌ No changes needed for ${title}`);
    }
  } catch (err) {
    console.error(`⚠️ Failed to update ${title}`, err);
  }
}

export default async function europeanParliamentPartyUpdate() {
  const api = WikiApi();
  const wikiDataApi = WikiDataAPI();
  await api.login();
  await wikiDataApi.login();

  const articles: string[] = ['המפלגה הדמוקרטית החופשית',
    'מפלגת הפיראטים של גרמניה',
    'מפלגת העם האוסטרית',
    'מפלגת הירוקים (אוסטריה)',
    'NEOS – אוסטריה החדשה והפורום הליברלי',
    'המפלגה הסוציאל-דמוקרטית האוסטרית',
    'מפלגת הירוקים (שוודיה)',
    'מפלגת השמאל (שוודיה)',
    'המפלגה העממית הליברלית',
    'הסוציאל-דמוקרטים (מפלגה שוודית)',
    'המפלגה הפרוגרסיבית של העם העובד',
    'המפלגה הדמוקרטית (קפריסין)',
    'החזית העממית הלאומית',
    'האספה הדמוקרטית',
    'ווקס (מפלגה)',
    'מפלגת המולדת (אסטוניה)',
    'המפלגה הקומוניסטית של יוון',
    'מפלגת הפינים',
    'סיריזה',
    'המפלגה הסוציאל-דמוקרטית של פינלנד',
    'איחוד המולדת',
    'המפלגה הלאומית (מלטה)',
    "כן (מפלגה צ'כית)"];

  await promiseSequence(1, articles.map((title) => async () => processArticle(api, wikiDataApi, title)));
}
