import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import getDrafts, { getDumpModificationTimes } from './getDrafts';
import { ArticleLog } from '../../admin/types';
import writeAdminBotLogs from '../../admin/log';
import { logger, stringify } from '../../utilities/logger';

const PAGE_TITLE = 'ויקיפדיה:בוט/הסרת דפי טיוטה מקטגוריות של מרחב הערכים';
const LAST_RUN_PAGE = `${PAGE_TITLE}/ריצה אחרונה`;
const MAX_TIME_DIFF_HOURS = 5;

const getLastRunTime = async (api: IWikiApi): Promise<Date | null> => {
  try {
    const { content } = await api.articleContent(LAST_RUN_PAGE);
    const trimmed = content.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      logger.logWarning(`Invalid date format in ${LAST_RUN_PAGE}: "${trimmed}"`);
      return null;
    }
    return date;
  } catch (error) {
    logger.logWarning(`Could not read ${LAST_RUN_PAGE}: ${stringify(error)}`);
    return null;
  }
};

const updateLastRunTime = async (api: IWikiApi, time: Date): Promise<void> => {
  try {
    const { revid } = await api.articleContent(LAST_RUN_PAGE);
    await api.edit(LAST_RUN_PAGE, 'עדכון זמן ריצה אחרון', time.toISOString(), revid);
    console.log(`Updated ${LAST_RUN_PAGE} with time: ${time.toISOString()}`);
  } catch (error) {
    logger.logError(`Failed to update ${LAST_RUN_PAGE}: ${stringify(error)}`);
  }
};

const validateDumpTimes = (
  times: { page: Date; categorylinks: Date; linktarget: Date },
  lastRunTime: Date | null,
): { valid: boolean; reason?: string; latestTime: Date } => {
  const allTimes = [times.page, times.categorylinks, times.linktarget];
  const earliest = new Date(Math.min(...allTimes.map((t) => t.getTime())));
  const latest = new Date(Math.max(...allTimes.map((t) => t.getTime())));

  console.log(`Dump modification times:
    page: ${times.page.toISOString()}
    categorylinks: ${times.categorylinks.toISOString()}
    linktarget: ${times.linktarget.toISOString()}
    earliest: ${earliest.toISOString()}
    latest: ${latest.toISOString()}`);

  if (lastRunTime) {
    console.log(`Last run time: ${lastRunTime.toISOString()}`);
    if (earliest <= lastRunTime) {
      return {
        valid: false,
        reason: `Earliest dump (${earliest.toISOString()}) is not after last run time (${lastRunTime.toISOString()})`,
        latestTime: latest,
      };
    }
  }

  const timeDiffMs = latest.getTime() - earliest.getTime();
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

  if (timeDiffHours > MAX_TIME_DIFF_HOURS) {
    return {
      valid: false,
      reason: `Dumps are ${timeDiffHours.toFixed(2)} hours apart, exceeding maximum of ${MAX_TIME_DIFF_HOURS} hours`,
      latestTime: latest,
    };
  }

  return { valid: true, latestTime: latest };
};

const removeDraftsFromCategory = async (draft: string, api: IWikiApi): Promise<ArticleLog | null> => {
  const nameWithoutUnderscores = draft.replaceAll('_', ' ');
  try {
    const { content, revid } = await api.articleContent(draft);
    const newContent = content.replaceAll('[[קטגוריה:', '[[:קטגוריה:');
    if (newContent === content) {
      console.log(`No changes for draft ${draft}, skipping`);
      return null;
    }
    await api.edit(draft, 'הסרת דף טיוטה מקטגוריות של מרחב הערכים', newContent, revid);
    return { title: nameWithoutUnderscores, text: `[[${nameWithoutUnderscores}]]` };
  } catch (error) {
    try {
      const [info] = await api.info([nameWithoutUnderscores]);
      if (info?.missing) {
        console.log(`Draft ${nameWithoutUnderscores} is missing, skipping`);
        return null;
      }
    } catch {
      logger.logError(`Failed to get info for ${nameWithoutUnderscores}`);
    }
    logger.logError(`Failed to remove draft ${nameWithoutUnderscores}: ${stringify(error)}`);
    return { title: nameWithoutUnderscores, text: `[[${nameWithoutUnderscores}]]`, error: true };
  }
};

export async function removeDraftsFromCategories() {
  const api = WikiApi();
  await api.login();

  console.log('Checking dump file modification times...');
  const dumpTimes = await getDumpModificationTimes();
  const lastRunTime = await getLastRunTime(api);

  const validation = validateDumpTimes(dumpTimes, lastRunTime);

  if (!validation.valid) {
    console.log(`Skipping run: ${validation.reason}`);
    return;
  }

  console.log('Validation passed, proceeding with draft removal...');

  const drafts = await getDrafts();
  const logs: ArticleLog[] = [];
  for (const draft of drafts) {
    const log = await removeDraftsFromCategory(draft, api);
    if (log) {
      logs.push(log);
    }
  }

  await writeAdminBotLogs(api, logs, PAGE_TITLE, false);
  await updateLastRunTime(api, validation.latestTime);

  console.log('Done');
}

export const main = botLoggerDecorator(removeDraftsFromCategories, { botName: 'בוט הסרת טיוטות מקטגוריות' });
