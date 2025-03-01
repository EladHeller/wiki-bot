import { ArticleLog } from '../../admin/types';
import { WikiPage } from '../../types';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const prefix = 'דגל/';

async function* getPages(api: IWikiApi): AsyncGenerator<WikiPage[], void, void> {
  const queryPath = `?action=query&generator=allpages&gapprefix=${prefix}&gapnamespace=10&gaplimit=50&prop=info&inprop=protection&format=json`;

  yield* api.continueQuery(queryPath, (result) => Object.values(result.query.pages));
}

const levels = ['sysop', 'editautopatrolprotected'];

export default async function protectFlags() {
  const api = WikiApi();
  try {
    const pagesGenerator = getPages(api);
    const logContent = await api.articleContent('משתמש:Sapper-bot/הגנת תבניות דגל');
    if (!logContent?.revid) {
      console.log('No log content');
      return;
    }
    const logs: ArticleLog[] = [];
    for await (const pages of pagesGenerator) {
      for (const page of pages) {
        const editProtect = page.protection?.some(({ type, expiry, level }) => type === 'edit' && expiry === 'infinity' && levels.includes(level));
        const moveProtect = page.protection?.some(({ type, expiry, level }) => type === 'move' && expiry === 'infinity' && levels.includes(level));
        if (!editProtect || !moveProtect) {
          try {
            await api.protect(page.title, 'edit=editautopatrolprotected|move=editautopatrolprotected', 'never', 'תבנית דגל: בשימוש רב');
            logs.push({
              title: page.title,
              text: page.protection?.map(({ type, level }) => `${type} - ${level}`).join(', ') || '',
              error: false,
            });
          } catch (e) {
            console.error(e);
            logs.push({
              title: page.title,
              text: e.message || e.toString(),
              error: true,
            });
          }
        }
      }
    }

    const successLogsText = logs.filter((log) => !log.error).map((log) => `* [[${log.title}]]`).join('\n');
    const errorLogsText = logs.filter((log) => log.error).map((log) => `* [[${log.title}]] - ${log.text}`).join('\n');
    await api.edit('משתמש:Sapper-bot/הגנת תבניות דגל', 'לוג ריצה', `סך הכל ${logs.length} תבניות.\n${successLogsText}\n===שגיאות===\n${errorLogsText}`, logContent.revid, 'לוג ריצה');
  } catch (e) {
    console.error(e);
  }
}
