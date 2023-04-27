import { getLocalDate } from '../utilities';
import { getArticleContent, updateArticle } from '../wiki/wikiAPI';

export interface ArticleLog {
    text: string;
    error?: boolean;
    skipped?: boolean;
}

const tagsPage = 'משתמש:Sapper-bot/תיוג משתמשים';

function getContentFromLogs(logs: ArticleLog[]): string {
  if (!logs.length) {
    return '';
  }
  return `* ${logs.map(({ text }) => text).join('\n* ')}\n`;
}

let tagsPageContent: string| undefined;

async function getUsersToTag(users: string[] = []): Promise<string> {
  if (tagsPageContent == null) {
    tagsPageContent = await getArticleContent(tagsPage);
  }
  const dynamicTagUsers = tagsPageContent?.split('\n').map((line) => line.replace('*', '').trim()) ?? [];
  if (!dynamicTagUsers.length && !users.length) {
    return '';
  }
  return `${[...new Set([...users, ...dynamicTagUsers])].join(', ')} לידיעתכם. ~~~~`;
}

export default async function writeAdminBotLogs(
  logs: ArticleLog[],
  logPageTitle: string,
  users?: string[],
) {
  if (!logs.length) {
    return;
  }

  const success = logs.filter((log) => !log.error && !log.skipped);
  const errors = logs.filter((log) => log.error);
  const skipped = logs.filter((log) => log.skipped);
  const successContent = getContentFromLogs(success);
  const errorContent = `${errors.length ? '===שגיאות===\n' : ''}${getContentFromLogs(errors)}`;
  const skippedContent = `${skipped.length ? '===דפים שדולגו===\n' : ''}${getContentFromLogs(skipped)}`;
  const usersToTag = await getUsersToTag(users);
  const titleAndSummary = `לוג ריצה ${getLocalDate(new Date().toLocaleString())}`;
  await updateArticle(
    logPageTitle,
    titleAndSummary,
    `${successContent}${errorContent}${skippedContent}\n${usersToTag}`,
    titleAndSummary,
  );
}
