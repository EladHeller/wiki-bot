import { getLocalDate } from '../utilities';
import { getUsersFromTagParagraph } from '../wiki/paragraphParser';
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

async function getAdminUsersToTag(users: string[] = []): Promise<string[]> {
  if (tagsPageContent == null) {
    tagsPageContent = await getArticleContent(tagsPage);
  }
  const dynamicTagUsers = tagsPageContent?.split('\n').map((line) => line.replace('*', '').trim()) ?? [];
  if (!dynamicTagUsers.length && !users.length) {
    return [];
  }
  return dynamicTagUsers;
}

async function getUsersToTagFromSpecialPage(page: string): Promise<string[]> {
  const content = await getArticleContent(page);
  if (!content) {
    return [];
  }
  return getUsersFromTagParagraph(content, 'פסקת תיוג');
}

export default async function writeAdminBotLogs(
  logs: ArticleLog[],
  logPageTitle: string,
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
  const adminUsersToTag = await getAdminUsersToTag();
  const specificUsersToTag = await getUsersToTagFromSpecialPage(logPageTitle);
  const usersToTag = `${[...new Set([...adminUsersToTag, ...specificUsersToTag])].join(', ')} לידיעתכם. ~~~~`;
  const titleAndSummary = `לוג ריצה ${getLocalDate(new Date().toLocaleString())}`;
  await updateArticle(
    logPageTitle,
    titleAndSummary,
    `${successContent}${errorContent}${skippedContent}\n${usersToTag}`,
    titleAndSummary,
  );
}
