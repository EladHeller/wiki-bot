import { JSDOM } from 'jsdom';
import checkCopyViolations, { CopyViolaionRank, CopyViolationResponse } from '../API/copyvios';
import writeAdminBotLogs from '../admin/log';
import type { ArticleLog } from '../admin/types';
import shabathProtectorDecorator, { isAfterShabathOrHolliday } from '../decorators/shabathProtector';
import type { LogEvent, WikiPage } from '../types';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../utilities';
import WikiApi from '../wiki/WikiApi';
import { getInnerLinks } from '../wiki/wikiLinkParser';
import { Paragraph } from '../wiki/paragraphParser';

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
const BASE_PAGE = 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים';
const LAST_RUN_PAGE = `${BASE_PAGE}/ריצה אחרונה`;
const TEMP_ERRORS_PAGE = `${BASE_PAGE}/שגיאות זמניות`;
const LOG_PAGE = `${BASE_PAGE}/לוג`;
const SELECTED_QOUTE = 'ציטוט_נבחר';
const WEBSITE_FOR_VISIT = 'אתר לביקור';
const DRAFT = 'טיוטה';
const TEMP_ERRORS = ['timeout', 'search_error', 'unhandled_exception'];

function copyviosSearchLink(title: string) {
  return `https://copyvios.toolforge.org/?lang=he&project=wikipedia&title=${title.replace(/ /g, '_').replace(/"/g, '%22')}&oldid=&action=search&use_engine=1&use_links=1&turnitin=0`;
}

function escapeTitle(title: string) {
  if (title.startsWith('קובץ:') || title.startsWith('קטגוריה:')) {
    return `:${title}`;
  }
  return title;
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

async function getLastRun(api: ReturnType<typeof WikiApi>): Promise<{revid: number, content: string}> {
  const lastRunResult = await api.articleContent(LAST_RUN_PAGE);
  if (lastRunResult) {
    return lastRunResult;
  }
  const hours = isAfterShabathOrHolliday() ? 36 : 12;

  const lastRunFromDate = new Date();
  lastRunFromDate.setHours(lastRunFromDate.getHours() - hours);
  lastRunFromDate.setMinutes(0);
  lastRunFromDate.setSeconds(0);
  lastRunFromDate.setMilliseconds(0);
  return {
    content: lastRunFromDate.toJSON(),
    revid: -1,
  };
}

const NOT_FOUND = 'not found';
const DISAMBIGUATION = 'פירושונים';
const SEARCH_ERROR = 'שגיאת חיפוש';

export async function getHamichlolPageContent(title: string) {
  const res = await fetch(`${HAMICHLOL_DOMAIN}${encodeURIComponent(title)}`);
  if (!res.ok) {
    return null;
  }
  const jsdomPage = new JSDOM(await res.text());
  return jsdomPage.window.document.body.textContent;
}

const hamichlolNotProblem = [
  'אין באפשרותך לקרוא את הדף הזה, מהסיבה הבאה',
  'בערך זה קיים תוכן בעייתי',
  'הערך באדיבות ויקיפדיה העברית',
  'המכלול: ערכים מילוניים',
];

export async function checkHamichlol(title: string, wikipediaTitle = title) {
  const hamichlolPageText = await getHamichlolPageContent(title);
  try {
    if (hamichlolPageText && hamichlolNotProblem.some((text) => hamichlolPageText.includes(text))) {
      console.log(`Hamichlol from wiki: ${wikipediaTitle}`);
      return null;
    }
    console.log(`Is from Hamichlol?: ${wikipediaTitle}`);
    const res = await checkCopyViolations(wikipediaTitle, 'he', `${HAMICHLOL_DOMAIN}${encodeURIComponent(title)}`);
    if (res.error) {
      console.error('Error in Hamichlol.', res.error);
      return null; // ignore Hamichlol errors
    }
    if (res.best?.violation === 'none') {
      return null; // ignore Hamichlol if violation confidence is low
    }
    return res;
  } catch {
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
  let titleForHamichlol = title;
  if (!isMainNameSpace) {
    titleForHamichlol = title.split(/[:/]/).at(-1) ?? '';
  }
  if (titleForHamichlol && titleForHamichlol !== DRAFT) {
    results.push(await checkHamichlol(titleForHamichlol));
    results.push(await checkHamichlol(`רבי ${titleForHamichlol}`, title));
    results.push(await checkHamichlol(`הרב ${titleForHamichlol}`, title));
  }
  results.forEach((res) => {
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

      if (res.error?.code && TEMP_ERRORS.includes(res.error.code)) {
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
        text: `[[${escapeTitle(title)}]] - ${res.error?.info}`,
        error: true,
      });

      return;
    }

    const { url, confidence, violation } = res.best ?? { violation: 'none', confidence: 0 };
    if (violation === 'none') {
      otherLogs.push({
        title,
        text: `[[${escapeTitle(title)}]] ${confidence.toFixed(2)}`,
        rank: confidence,
      });
      return;
    }
    const matchText = textFromMatch(confidence, violation, url, title);
    logs.push({
      title,
      text: `[[${escapeTitle(title)}]]{{כ}}${matchText}`,
      rank: confidence,
    });
  });

  return {
    logs,
    otherLogs,
  };
}

export default async function copyrightViolationBot() {
  const api = WikiApi();
  const currentRun = new Date();
  const lastRun = await getLastRun(api);
  const { content: tempErrorsContent, revid: tempErrorsRevid } = await api.articleContent(TEMP_ERRORS_PAGE);
  const tempErrors = getInnerLinks(tempErrorsContent);
  const generator = api.newPages([0, 2, 118], lastRun.content);

  const allLogs: ArticleLog[] = [];
  const allOtherLogs: ArticleLog[] = [];

  await asyncGeneratorMapWithSequence(3, generator, (page: WikiPage) => async () => {
    const { logs, otherLogs } = await handlePage(page.title, page.ns === 0);
    allLogs.push(...logs);
    allOtherLogs.push(...otherLogs);
  });
  const logsGenerator = api.logs('move', [0, 2, 118], lastRun.content);

  await asyncGeneratorMapWithSequence(3, logsGenerator, (log: LogEvent) => async () => {
    if (!log.title || log.params?.target_ns == null || log.params.target_title == null
       || log.params.target_ns === log.ns) {
      return;
    }
    const { logs, otherLogs } = await handlePage(log.params.target_title, log.params.target_ns === 0);
    allLogs.push(...logs);
    allOtherLogs.push(...otherLogs);
  });

  await promiseSequence(3, tempErrors.map(({ link }) => async () => {
    const [pageInfo] = await api.info([link]);
    const { logs, otherLogs } = await handlePage(link, pageInfo.ns === 0);
    allLogs.push(...logs);
    allOtherLogs.push(...otherLogs);
  }));
  allLogs.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

  await writeAdminBotLogs(api, allLogs, BASE_PAGE);
  const notFoundText = allOtherLogs.filter(({ text }) => text === NOT_FOUND).map(({ title }) => `[[${escapeTitle(title)}]]`).join(' • ');
  const disambiguationText = allOtherLogs.filter(({ text }) => text === DISAMBIGUATION).map(({ title }) => `[[${escapeTitle(title)}]]`).join(' • ');
  const quotesText = allOtherLogs.filter(({ text }) => text === SELECTED_QOUTE).map(({ title }) => `[[${escapeTitle(title)}]]`).join(' • ');
  const websiteText = allOtherLogs.filter(({ text }) => text === WEBSITE_FOR_VISIT).map(({ title }) => `[[${escapeTitle(title)}]]`).join(' • ');
  const searchErrorText = allOtherLogs.filter(({ text }) => text === SEARCH_ERROR).map(({ title }) => `[[${escapeTitle(title)}]]`).join(' • ');
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
  await writeAdminBotLogs(api, paragraphs, LOG_PAGE);
  await api.edit(LAST_RUN_PAGE, 'עדכון זמן ריצה', currentRun.toJSON(), lastRun.revid);
  if (searchErrorText !== tempErrorsContent) {
    await api.edit(TEMP_ERRORS_PAGE, 'עדכון שגיאות', searchErrorText, tempErrorsRevid);
  }
}

export const main = shabathProtectorDecorator(copyrightViolationBot);
