import checkCopyViolations, { CopyViolaionRank } from '../API/copyvios';
import writeAdminBotLogs from '../admin/log';
import type { ArticleLog } from '../admin/types';
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

export default async function copyrightViolationBot() {
  const api = NewWikiApi();
  const hours = isAfterShabathOrHolliday() ? 36 : 12;
  const lastRun = new Date();
  lastRun.setHours(lastRun.getHours() - hours);
  const generator = api.newPages([0, 118], lastRun.toJSON());

  const logs: ArticleLog[] = [];

  await asyncGeneratorMapWithSequence(10, generator, (page: WikiPage) => async () => {
    const res = await checkCopyViolations(page.title);
    if (res.status === 'error') {
      logs.push({
        title: page.title,
        text: `[[${page.title}]] - ${res.error?.info}`,
        error: true,
      });
      return;
    }
    const { url, confidence, violation } = res.best ?? { violation: 'none', confidence: 0 };
    const text = url == null ? ': אין התאמה' : `: [${url} התאמה טובה ביותר], ציון: ${confidence.toFixed(2)}, הפרה: {{עיצוב גופן|טקסט=${violationText[violation]}|צבע=${violationColor[violation]}}}.`;
    logs.push({
      title: page.title,
      text: `[[${page.title}]]{{כ}}${text}`,
    });
  });

  await writeAdminBotLogs(logs, 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים');
}

export const main = shabathProtectorDecorator(copyrightViolationBot);
