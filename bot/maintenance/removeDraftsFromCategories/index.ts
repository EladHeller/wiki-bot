import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import getDrafts from './getDrafts';
import { ArticleLog } from '../../admin/types';
import writeAdminBotLogs from '../../admin/log';

async function removeDraftsFromCategory(draft: string, api: IWikiApi): Promise<ArticleLog | null> {
  try {
    const { content, revid } = await api.articleContent(draft);
    const newContent = content.replaceAll('[[קטגוריה:', '[[:קטגוריה:');
    if (newContent === content) {
      console.log(`No changes for draft ${draft}, skipping`);
      return null;
    }
    await api.edit(draft, 'הסרת דף טיוטה מקטגוריות של מרחב הערכים', newContent, revid);
    return { title: draft, text: `[[${draft}]]` };
  } catch (error) {
    console.error(`Error removing draft ${draft}`, error);
    return { title: draft, text: `[[${draft}]]`, error: true };
  }
}

export async function removeDraftsFromCategories() {
  const api = WikiApi();
  await api.login();
  const drafts = await getDrafts();
  const logs: ArticleLog[] = [];
  for (const draft of drafts) {
    const log = await removeDraftsFromCategory(draft, api);
    if (log) {
      logs.push(log);
    }
  }
  await writeAdminBotLogs(api, logs, 'ויקיפדיה:בוט/הסרת דפי טיוטה מקטגוריות של מרחב הערכים', false);
  console.log('Done');
}

export const main = shabathProtectorDecorator(removeDraftsFromCategories);
