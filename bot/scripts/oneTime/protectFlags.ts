import { ArticleLog } from '../../admin/types';
import { WikiPage } from '../../types';
import NewWikiApi, { IWikiApi } from '../../wiki/NewWikiApi';

const prefix = 'דגל/';

async function* getPages(api: IWikiApi): AsyncGenerator<WikiPage[], void, void> {
  const queryPath = `?action=query&generator=allpages&gapprefix=${prefix}&gapnamespace=10&gaplimit=50&prop=info&inprop=protection&format=json`;

  yield* api.continueQuery(queryPath, (result) => Object.values(result.query.pages));
}

export default async function protectFlags() {
  const api = NewWikiApi();
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
        const editProtect = page.protection?.some(({ type, expiry }) => type === 'edit' && expiry === 'infinity');
        const moveProtect = page.protection?.some(({ type, expiry }) => type === 'move' && expiry === 'infinity');
        if (!editProtect || !moveProtect) {
          try {
            await api.protect(page.title, 'edit=editautopatrolprotected|move=editautopatrolprotected', 'never', 'תבנית דגל: בשימוש רב');
            logs.push({
              title: page.title,
              text: 'הצליח',
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
    await api.edit('משתמש:Sapper-bot/הגנת תבניות דגל', 'ריצה מקדימה', `סך הכל ${logs.length} תבניות.\n${successLogsText}\n===שגיאות===\n${errorLogsText}`, logContent.revid, 'ריצת אמת');
  } catch (e) {
    console.error(e);
  }
}
