import checkCopyViolations, { CopyViolaionRank, CopyViolationResponse } from '../API/copyvios';
import writeAdminBotLogs from '../admin/log';
import type { ArticleLog, Paragraph } from '../admin/types';
import shabathProtectorDecorator, { isAfterShabathOrHolliday } from '../decorators/shabathProtector';
import type { LogEvent, WikiPage } from '../types';
import { asyncGeneratorMapWithSequence, encodeWikiUrl } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import { getInnerLinks } from '../wiki/wikiLinkParser';

const violationColor: Record<CopyViolaionRank, string> = {
  suspected: 'אדום',
  possible: 'כתום',
  none: 'ירוק',
};

const violationText: Record<CopyViolaionRank, string> = {
  suspected: 'חשוד',
  possible: 'אפשרי',
  none: 'אין',
};
const HAMICHLOL_DOMAIN = 'https://www.hamichlol.org.il/';
const WIKIPEDIA_DOMAIN = 'https://he.wikipedia.org/wiki/';
const BASE_PAGE = 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים';
const LAST_RUN_PAGE = `${BASE_PAGE}/ריצה אחרונה`;
const SEARCH_ERROR_PAGE = `${BASE_PAGE}/שגיאות זמניות`;
const LOG_PAGE = `${BASE_PAGE}/לוג`;
const SELECTED_QOUTE = 'ציטוט_נבחר';
const WEBSITE_FOR_VISIT = 'אתר לביקור';
const DRAFT = 'טיוטה';

function copyviosSearchLink(title: string) {
  return `https://copyvios.toolforge.org/?lang=he&project=wikipedia&title=${title.replace(/ /g, '_').replace(/"/g, '%22')}&oldid=&action=search&use_engine=1&use_links=1&turnitin=0`;
}

function textFromMatch(
  confidence: number,
  violation: CopyViolaionRank,
  url: string | undefined,
  title: string,
) {
  if (url == null) {
    return ': אין התאמה';
  }
  const linkToCopyviosText = 'קישור לחיפוש ב-copyvios';

  const link = url.startsWith(HAMICHLOL_DOMAIN)
    ? `[${url} ${decodeURIComponent(url.replace(HAMICHLOL_DOMAIN, '').replace(/_/g, ' '))} במכלול]`
    : `[${copyviosSearchLink(title)} ${linkToCopyviosText}]`;
  return `: ${link}, ציון: ${confidence.toFixed(2)}, הפרה: {{עיצוב גופן|טקסט=${violationText[violation]}|צבע=${violationColor[violation]}}}.`;
}

async function getLastRun(api: ReturnType<typeof NewWikiApi>): Promise<string> {
  const lastRunFromWiki = await api.getArticleContent(LAST_RUN_PAGE);
  if (lastRunFromWiki) {
    return lastRunFromWiki;
  }
  const hours = isAfterShabathOrHolliday() ? 36 : 12;

  const lastRunFromDate = new Date();
  lastRunFromDate.setHours(lastRunFromDate.getHours() - hours);
  lastRunFromDate.setMinutes(0);
  lastRunFromDate.setSeconds(0);
  lastRunFromDate.setMilliseconds(0);
  return lastRunFromDate.toJSON();
}

const NOT_FOUND = 'not found';
const DISAMBIGUATION = 'פירושונים';
const SEARCH_ERROR = 'שגיאת חיפוש';

export async function checkHamichlol(title: string, wikipediaTitle = title) {
  try {
    const res = await fetch(`${HAMICHLOL_DOMAIN}${encodeURIComponent(title)}`);
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    if (text.includes('בערך זה קיים תוכן בעייתי') || text.includes(WIKIPEDIA_DOMAIN + encodeWikiUrl(title))) {
      console.log(`Hamichlol from wiki: ${wikipediaTitle}`);
      return null;
    }
    console.log(`Is from Hamichlol?: ${wikipediaTitle}`);
    return checkCopyViolations(wikipediaTitle, 'he', `${HAMICHLOL_DOMAIN}${encodeURIComponent(title)}`);
  } catch (e) {
    return null;
  }
}

async function handlePage(title: string, isMainNameSpace: boolean) {
  const logs: ArticleLog[] = [];
  const otherLogs: ArticleLog[] = [];
  if (title.includes(`(${DISAMBIGUATION})`)) {
    otherLogs.push({
      text: DISAMBIGUATION,
      title,
      error: true,
    });
    return { logs, otherLogs };
  }
  if (title.includes(`/${SELECTED_QOUTE}/`)) {
    otherLogs.push({
      text: SELECTED_QOUTE,
      title,
      error: false,
    });
  }

  if (title.includes(`/${WEBSITE_FOR_VISIT}/`)) {
    otherLogs.push({
      text: WEBSITE_FOR_VISIT,
      title,
      error: false,
    });
  }

  const results: Array<CopyViolationResponse | null> = [await checkCopyViolations(title, 'he')];
  if (isMainNameSpace) {
    results.push(await checkHamichlol(title));
    results.push(await checkHamichlol(`רבי ${title}`, title));
    results.push(await checkHamichlol(`הרב ${title}`, title));
  } else {
    const lastPart = title.split(/[:/]/).at(-1);
    if (lastPart && lastPart !== DRAFT) {
      results.push(await checkHamichlol(lastPart, title));
      results.push(await checkHamichlol(`רבי ${lastPart}`, title));
      results.push(await checkHamichlol(`הרב ${lastPart}`, title));
    }
  }
  results.forEach(async (res) => {
    if (res == null) {
      return;
    }
    if (res.status === 'error') {
      if (res.error?.code === 'no_data') { // Url not found
        return;
      }

      if (res.error?.code === 'bad_title') {
        otherLogs.push({
          text: NOT_FOUND,
          title,
          error: true,
        });
        return;
      }

      if (res.error?.code === 'search_error') {
        otherLogs.push({
          text: SEARCH_ERROR,
          title,
          error: true,
        });
        return;
      }
      console.log(res.error);
      logs.push({
        title,
        text: `[[${title}]] - ${res.error?.info}`,
        error: true,
      });

      return;
    }

    const { url, confidence, violation } = res.best ?? { violation: 'none', confidence: 0 };
    if (violation === 'none') {
      otherLogs.push({
        title,
        text: `[[${title}]] ${confidence.toFixed(2)}${url ? ` [${url}]` : ''}`,
        rank: confidence,
      });
      return;
    }
    const matchText = textFromMatch(confidence, violation, url, title);
    logs.push({
      title,
      text: `[[${title}]]{{כ}}${matchText}`,
      rank: confidence,
    });
  });

  return {
    logs,
    otherLogs,
  };
}

async function handlePreviousErrors(errorPagesTitles: string[]) {
  const allLogs: ArticleLog[] = [];
  const allOtherLogs: ArticleLog[] = [];

  for (const title of errorPagesTitles) {
    const { logs, otherLogs } = await handlePage(title, !title.includes(':'));
    allLogs.push(...logs);
    allOtherLogs.push(...otherLogs);
  }

  return { logs: allLogs, otherLogs: allOtherLogs };
}

export default async function copyrightViolationBot() {
  const api = NewWikiApi();
  const currentRun = new Date();
  const lastRun = await getLastRun(api);
  const searchErrorPage = await api.articleContent(SEARCH_ERROR_PAGE);

  const generator = api.newPages([0, 2, 118], lastRun);

  const allLogs: ArticleLog[] = [];
  const allOtherLogs: ArticleLog[] = [];

  if (searchErrorPage && searchErrorPage.content.length) {
    const links = getInnerLinks(searchErrorPage.content);
    const { logs, otherLogs } = await handlePreviousErrors(links.map((link) => link.link));
    allLogs.push(...logs);
    allOtherLogs.push(...otherLogs);
  }

  await asyncGeneratorMapWithSequence(1, generator, (page: WikiPage) => async () => {
    const { logs, otherLogs } = await handlePage(page.title, page.ns === 0);
    allLogs.push(...logs);
    allOtherLogs.push(...otherLogs);
  });
  const logsGenerator = api.logs('move', [0, 2, 118], lastRun);

  await asyncGeneratorMapWithSequence(1, logsGenerator, (log: LogEvent) => async () => {
    if (!log.title || log.params?.target_ns == null || log.params.target_title == null
       || log.params.target_ns === log.ns) {
      return;
    }
    const { logs, otherLogs } = await handlePage(log.params.target_title, log.params.target_ns === 0);
    allLogs.push(...logs);
    allOtherLogs.push(...otherLogs);
  });
  allLogs.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

  await writeAdminBotLogs(allLogs, BASE_PAGE);
  const notFoundText = allOtherLogs.filter(({ text }) => text === NOT_FOUND).map(({ title }) => `[[${title}]]`).join(' • ');
  const disambiguationText = allOtherLogs.filter(({ text }) => text === DISAMBIGUATION).map(({ title }) => `[[${title}]]`).join(' • ');
  const quotesText = allOtherLogs.filter(({ text }) => text === SELECTED_QOUTE).map(({ title }) => `[[${title}]]`).join(' • ');
  const websiteText = allOtherLogs.filter(({ text }) => text === WEBSITE_FOR_VISIT).map(({ title }) => `[[${title}]]`).join(' • ');
  const searchErrorText = allOtherLogs.filter(({ text }) => text === SEARCH_ERROR).map(({ title }) => `[[${title}]]`).join(' • ');
  const otherText = allOtherLogs.filter(({ error }) => !error)
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
    .map(({ text }) => text).join(' • ');
  const paragraphs = [{
    name: 'דפים ללא הפרה',
    content: otherText,
  }, {
    name: DISAMBIGUATION,
    content: disambiguationText,
  }, {
    name: SELECTED_QOUTE,
    content: quotesText,
  }, {
    name: WEBSITE_FOR_VISIT,
    content: websiteText,
  }, {
    name: 'שגיאות זמניות (יטופלו בריצה חוזרת)',
    content: searchErrorText,
  }, {
    name: 'דפים שנמחקו לפני ריצת הבוט',
    content: notFoundText,
  }].filter((p) => p.content) satisfies Paragraph[];
  await writeAdminBotLogs(paragraphs, LOG_PAGE);
  await api.updateArticle(LAST_RUN_PAGE, 'עדכון זמן ריצה', currentRun.toJSON());
  if (searchErrorText && searchErrorPage) {
    await api.edit(SEARCH_ERROR_PAGE, 'עדכון שגיאות', searchErrorText, searchErrorPage.revid);
  }
}

export const main = shabathProtectorDecorator(copyrightViolationBot);
