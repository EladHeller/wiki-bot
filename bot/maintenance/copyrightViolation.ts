import checkCopyViolations, { CopyViolaionRank } from '../API/copyvios';
import writeAdminBotLogs from '../admin/log';
import type { ArticleLog, Paragraph } from '../admin/types';
import shabathProtectorDecorator, { isAfterShabathOrHolliday } from '../decorators/shabathProtector';
import type { WikiPage } from '../types';
import { asyncGeneratorMapWithSequence } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';

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

function textFromMatch(
  confidence: number,
  violation: CopyViolaionRank,
  url: string | undefined,
  best: boolean = false,
) {
  if (url == null) {
    return ': אין התאמה';
  }
  const matchText = best ? 'התאמה טובה ביותר' : 'התאמה';
  return `: [${url} ${matchText}], ציון: ${confidence.toFixed(2)}, הפרה: {{עיצוב גופן|טקסט=${violationText[violation]}|צבע=${violationColor[violation]}}}.`;
}

const BASE_PAGE = 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים';
const LAST_RUN_PAGE = `${BASE_PAGE}/ריצה אחרונה`;
const LOG_PAGE = `${BASE_PAGE}/לוג`;

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

export default async function copyrightViolationBot() {
  const api = NewWikiApi();
  const currentRun = new Date();
  currentRun.setMinutes(0);
  currentRun.setSeconds(0);
  const lastRun = await getLastRun(api);

  const generator = api.newPages([0, 118], lastRun);

  const logs: ArticleLog[] = [];
  const otherLogs: ArticleLog[] = [];

  await asyncGeneratorMapWithSequence(2, generator, (page: WikiPage) => async () => {
    if (page.title.includes(`(${DISAMBIGUATION})`)) {
      otherLogs.push({
        text: DISAMBIGUATION,
        title: page.title,
        error: true,
      });
      return;
    }
    const res = await checkCopyViolations(page.title);
    if (res.status === 'error') {
      if (res.error?.code.includes(NOT_FOUND)) {
        otherLogs.push({
          text: NOT_FOUND,
          title: page.title,
          error: true,
        });
      } else {
        logs.push({
          title: page.title,
          text: `[[${page.title}]] - ${res.error?.info}`,
          error: true,
        });
      }
      return;
    }

    const { url, confidence, violation } = res.best ?? { violation: 'none', confidence: 0 };
    if (violation === 'none') {
      otherLogs.push({
        title: page.title,
        text: `[[${page.title}]] ${confidence} [${url}]`,
      });
      return;
    }
    const matchText = textFromMatch(confidence, violation, url, true);
    logs.push({
      title: page.title,
      text: `[[${page.title}]]{{כ}}${matchText}`,
      rank: confidence,
    });
    res.sources?.filter((source) => source.violation !== 'none' && source.url != null && source.url !== url).forEach((source) => {
      const currText = textFromMatch(source.confidence, source.violation, source.url);
      logs.push({
        title: page.title,
        text: `[[${page.title}]]{{כ}}${currText}`,
        rank: source.confidence,
      });
    });
  });
  logs.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

  await writeAdminBotLogs(logs, BASE_PAGE);
  const notFoundText = otherLogs.filter(({ text }) => text === NOT_FOUND).map(({ title }) => `[[${title}]]`).join(' • ');
  const disambiguationText = otherLogs.filter(({ text }) => text === DISAMBIGUATION).map(({ title }) => `[[${title}]]`).join(' • ');
  const otherText = otherLogs.filter(({ error }) => !error).map(({ text }) => text).join(' • ');
  const paragraphs = [{
    name: 'דפים ללא הפרה',
    content: otherText,
  }, {
    name: DISAMBIGUATION,
    content: disambiguationText,
  }, {
    name: 'דפים שנמחקו לפני ריצת הבוט',
    content: notFoundText,
  }] satisfies Paragraph[];
  await writeAdminBotLogs(paragraphs, LOG_PAGE);
}

export const main = shabathProtectorDecorator(copyrightViolationBot);
