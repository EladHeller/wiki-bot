import { ArticleLog } from '../../admin/types';
import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import WikiDataAPI, { IWikiDataAPI } from '../../wiki/WikidataAPI';
import {
  findTemplates,
  getTemplateKeyValueData,
} from '../../wiki/newTemplateParser';

const TEMPLATE_SINGLE = 'סינגל';
const TEMPLATE_ALBUM = 'אלבום';

const ALBUM_TYPE_TO_CATEGORY: Record<string, string> = {
  EP: 'מיני-אלבומים',
  'מיני-אלבום': 'מיני-אלבומים',
  'אלבום הופעה': 'אלבומי הופעה',
  הופעה: 'אלבומי הופעה',
  פסקול: 'פסקולים',
  'אלבום אוסף': 'אלבומי אוסף',
  אוסף: 'אלבומי אוסף',
  'מארז תקליטורים': 'אלבומי אוסף',
  'אלבום להיטים': 'אלבומי אוסף',
  להיטים: 'אלבומי אוסף',
  מיקסטייפ: 'מיקסטייפים',
  רמיקס: 'אלבומי רמיקס',
  וידאו: 'אלבומי וידאו',
};

export function extractYearFromDate(dateString: string): string | null {
  if (!dateString) {
    return null;
  }

  const cleanDate = dateString.replace(/\[\[/g, '').replace(/\]\]/g, '').trim();
  const yearMatch = cleanDate.match(/\b(\d{4})\b/);

  if (yearMatch) {
    return yearMatch[1];
  }

  return null;
}

export function getReleaseYearFromTemplate(templateData: Record<string, string>): string | null {
  const releaseDate = templateData['יצא לאור'];
  if (!releaseDate) {
    return null;
  }

  return extractYearFromDate(releaseDate);
}

export async function getReleaseYearFromWikidata(
  qid: string,
  wikiDataApi: IWikiDataAPI,
): Promise<string | null> {
  try {
    const claims = await wikiDataApi.getClaim(qid, 'P577');
    if (!claims || claims.length === 0) {
      return null;
    }

    const firstClaim = claims[0];
    const dateValue = firstClaim.mainsnak.datavalue?.value;

    if (!dateValue) {
      return null;
    }

    if (typeof dateValue === 'object' && dateValue.time) {
      return extractYearFromDate(dateValue.time);
    }

    if (typeof dateValue === 'string') {
      return extractYearFromDate(dateValue);
    }

    return null;
  } catch {
    console.log(`Failed to get wikidata claim for ${qid}`);
    return null;
  }
}

export function removeCategoryLine(content: string, categoryName: string): string {
  const regex = new RegExp(`\\[\\[קטגוריה:${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]\\n?`, 'g');
  return content.replace(regex, '');
}

export function processSingleTemplate(
  templateData: Record<string, string>,
  content: string,
  year: string,
): string {
  if (templateData['ללא קטגוריה'] === 'כן') {
    return content;
  }

  let updatedContent = content;
  updatedContent = removeCategoryLine(updatedContent, `שירי ${year}`);

  const type = templateData['סוג'];
  if (!type || type === 'סינגל' || type === 'שיר אירוויזיון') {
    updatedContent = removeCategoryLine(updatedContent, `סינגלים מ-${year}`);
  }

  return updatedContent;
}

export function processAlbumTemplate(
  templateData: Record<string, string>,
  content: string,
  year: string,
): string {
  if (templateData['ללא קטגוריה'] === 'כן') {
    return content;
  }

  let updatedContent = content;
  updatedContent = removeCategoryLine(updatedContent, `אלבומי ${year}`);

  const type = templateData['סוג'];
  if (type && ALBUM_TYPE_TO_CATEGORY[type]) {
    const categoryPrefix = ALBUM_TYPE_TO_CATEGORY[type];
    updatedContent = removeCategoryLine(updatedContent, `${categoryPrefix} מ-${year}`);
  }

  return updatedContent;
}

export async function processArticle(
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  page: WikiPage,
): Promise<ArticleLog | null> {
  try {
    const originalContent = page.revisions?.[0]?.slots.main['*'];
    const revid = page.revisions?.[0]?.revid;

    if (!originalContent || !revid) {
      console.error(`No content or revid for ${page.title}`);
      return null;
    }

    let updatedContent = originalContent;
    let hasChanges = false;

    const singleTemplates = findTemplates(originalContent, TEMPLATE_SINGLE, page.title);
    for (const template of singleTemplates) {
      const templateData = getTemplateKeyValueData(template);
      let year = getReleaseYearFromTemplate(templateData);

      if (!year) {
        const qid = await api.getWikiDataItem(page.title);
        if (qid) {
          year = await getReleaseYearFromWikidata(qid, wikiDataApi);
        }
      }

      if (year) {
        const newContent = processSingleTemplate(templateData, updatedContent, year);
        if (newContent !== updatedContent) {
          updatedContent = newContent;
          hasChanges = true;
        }
      } else {
        console.log(`No release year found for single in ${page.title}`);
      }
    }

    const albumTemplates = findTemplates(originalContent, TEMPLATE_ALBUM, page.title);
    for (const template of albumTemplates) {
      const templateData = getTemplateKeyValueData(template);
      let year = getReleaseYearFromTemplate(templateData);

      if (!year) {
        const qid = await api.getWikiDataItem(page.title);
        if (qid) {
          year = await getReleaseYearFromWikidata(qid, wikiDataApi);
        }
      }

      if (year) {
        const newContent = processAlbumTemplate(templateData, updatedContent, year);
        if (newContent !== updatedContent) {
          updatedContent = newContent;
          hasChanges = true;
        }
      } else {
        console.log(`No release year found for album in ${page.title}`);
      }
    }

    if (hasChanges && updatedContent !== originalContent) {
      await api.edit(
        page.title,
        'הסרת קטגוריות שנוספות אוטומטית מהתבנית',
        updatedContent,
        revid,
      );
      return { title: page.title, text: `[[${page.title}]]` };
    }

    return null;
  } catch (err) {
    console.error(`⚠️ Failed to update ${page.title}`, err);
    return { title: page.title, text: `[[${page.title}]]`, error: true };
  }
}

export default async function removeCategoriesFromSingleAlbum(apiInstance?: IWikiApi) {
  const api = apiInstance || WikiApi();
  const wikiDataApi = WikiDataAPI();

  await api.login();
  await wikiDataApi.login();

  let processedCount = 0;
  const logs: ArticleLog[] = [];

  console.log('Processing singles...');
  await asyncGeneratorMapWithSequence(
    10,
    api.getArticlesWithTemplate(TEMPLATE_SINGLE),
    (page) => async () => {
      const log = await processArticle(api, wikiDataApi, page);
      if (log) {
        logs.push(log);
      }
      processedCount += 1;
    },
  );

  console.log('Processing albums...');
  await asyncGeneratorMapWithSequence(
    10,
    api.getArticlesWithTemplate(TEMPLATE_ALBUM),
    (page) => async () => {
      const log = await processArticle(api, wikiDataApi, page);
      if (log) {
        logs.push(log);
      }
      processedCount += 1;
    },
  );

  console.log(`Processed ${processedCount} articles, updated ${logs.length}`);

  return {
    logs,
    processedCount,
  };
}
