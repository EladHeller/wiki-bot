import { ArticleLog } from '../../admin/types';
import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import {
  findTemplates,
  getTemplateKeyValueData,
} from '../../wiki/newTemplateParser';
import { IWikiApi } from '../../wiki/WikiApi';
import { IWikiDataAPI } from '../../wiki/WikidataAPI';

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

async function processTemplates(
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  originalContent: string,
  currentContent: string,
  pageTitle: string,
  templateName: string,
  processFunction: (templateData: Record<string, string>, content: string, year: string) => string,
  itemType: string,
): Promise<{ content: string; hasChanges: boolean }> {
  let updatedContent = currentContent;
  let hasChanges = false;

  const templates = findTemplates(originalContent, templateName, pageTitle);
  for (const template of templates) {
    const templateData = getTemplateKeyValueData(template);
    let year = getReleaseYearFromTemplate(templateData);

    if (!year) {
      const qid = await api.getWikiDataItem(pageTitle);
      if (qid) {
        year = await getReleaseYearFromWikidata(qid, wikiDataApi);
      }
    }

    if (year) {
      const newContent = processFunction(templateData, updatedContent, year);
      if (newContent !== updatedContent) {
        updatedContent = newContent;
        hasChanges = true;
      }
    } else {
      console.log(`No release year found for ${itemType} in ${pageTitle}`);
    }
  }

  return { content: updatedContent, hasChanges };
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
    let totalChanges = false;

    const singleResult = await processTemplates(
      api,
      wikiDataApi,
      originalContent,
      updatedContent,
      page.title,
      TEMPLATE_SINGLE,
      processSingleTemplate,
      'single',
    );
    updatedContent = singleResult.content;
    totalChanges = totalChanges || singleResult.hasChanges;

    const albumResult = await processTemplates(
      api,
      wikiDataApi,
      originalContent,
      updatedContent,
      page.title,
      TEMPLATE_ALBUM,
      processAlbumTemplate,
      'album',
    );
    updatedContent = albumResult.content;
    totalChanges = totalChanges || albumResult.hasChanges;

    if (totalChanges && updatedContent !== originalContent) {
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

async function processTemplateArticles(
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  templateName: string,
  logMessage: string,
): Promise<{ logs: ArticleLog[]; count: number }> {
  const logs: ArticleLog[] = [];
  let count = 0;

  console.log(logMessage);
  await asyncGeneratorMapWithSequence(
    10,
    api.getArticlesWithTemplate(templateName),
    (page) => async () => {
      const log = await processArticle(api, wikiDataApi, page);
      if (log) {
        logs.push(log);
      }
      count += 1;
    },
  );

  return { logs, count };
}

export default async function removeCategoriesFromSingleAlbum(
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
) {
  const singleResults = await processTemplateArticles(
    api,
    wikiDataApi,
    TEMPLATE_SINGLE,
    'Processing singles...',
  );

  const albumResults = await processTemplateArticles(
    api,
    wikiDataApi,
    TEMPLATE_ALBUM,
    'Processing albums...',
  );

  const logs = [...singleResults.logs, ...albumResults.logs];
  const processedCount = singleResults.count + albumResults.count;

  console.log(`Processed ${processedCount} articles, updated ${logs.length}`);

  return {
    logs,
    processedCount,
  };
}
