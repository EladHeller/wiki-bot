import { getLocalDate } from '../utilities';
import { getParagraphContent, getUsersFromTagParagraph } from '../wiki/paragraphParser';
import { getArticleContent, updateArticle } from '../wiki/wikiAPI';
import { getInnerLinks } from '../wiki/wikiLinkParser';
import { ArticleLog } from './types';

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
  if (!tagsPageContent) {
    return [];
  }
  const dynamicTagUsers = getInnerLinks(tagsPageContent);
  if (!dynamicTagUsers.length && !users.length) {
    return [];
  }
  return dynamicTagUsers.map(({ link, text }) => {
    if (link === text || !text) {
      return `[[${link}]]`;
    }
    return `[[${link}|${text}]]`;
  });
}

async function getUsersToTagFromSpecialPage(content?: string): Promise<string[]> {
  if (!content) {
    return [];
  }
  return getUsersFromTagParagraph(content, 'פסקת תיוג');
}

function isNightRun(titleAndSummary: string, content?: string): boolean {
  if (!content) {
    return false;
  }
  const paragraph = getParagraphContent(content, titleAndSummary);
  if (!paragraph) {
    return false;
  }
  return true;
}

export function filterDuplicateLog(skipped: ArticleLog[], articleContent = ''): ArticleLog[] {
  const innerLinks = getInnerLinks(articleContent);
  return skipped.filter((log) => !innerLinks.some(({ link }) => link === log.title));
}

export default async function writeAdminBotLogs(
  logs: ArticleLog[],
  logPageTitle: string,
) {
  if (!logs.length) {
    return;
  }

  const logPageContent = await getArticleContent(logPageTitle);
  const titleAndSummary = `לוג ריצה ${getLocalDate(new Date().toLocaleString())}`;
  const nightRun = isNightRun(titleAndSummary, logPageContent);
  const title = nightRun ? '===ריצת ערב===' : `==${titleAndSummary}==`;

  const subParagraphCode = nightRun ? '====' : '===';

  const success = logs.filter((log) => !log.error && !log.skipped && !log.needProtection);
  const errors = logs.filter((log) => log.error);
  const skipped = filterDuplicateLog(logs.filter((log) => log.skipped), logPageContent);
  const needProtection = filterDuplicateLog(
    logs.filter((log) => log.needProtection),
    logPageContent,
  );

  if (!success.length && !errors.length && !skipped.length && !needProtection.length) {
    return;
  }

  const successContent = getContentFromLogs(success);
  const errorContent = `${errors.length ? `${subParagraphCode}שגיאות${subParagraphCode}\n` : ''}${getContentFromLogs(errors)}`;
  const skippedContent = `${skipped.length ? `${subParagraphCode}דפים שדולגו${subParagraphCode}\n` : ''}${getContentFromLogs(skipped)}`;
  const needProtectionContent = `${needProtection.length ? `${subParagraphCode}דפים בעמוד הראשי שזקוקים להגנה${subParagraphCode}\n` : ''}${getContentFromLogs(needProtection)}`;

  const adminUsersToTag = await getAdminUsersToTag();
  const specificUsersToTag = await getUsersToTagFromSpecialPage(logPageContent);

  const usersToTag = `${[...new Set([...adminUsersToTag, ...specificUsersToTag])].join(', ')} לידיעתכם. ~~~~`;
  await updateArticle(
    logPageTitle,
    titleAndSummary,
    `${logPageContent}ֿ\n${title}\n${successContent}${errorContent}${skippedContent}${needProtectionContent}\n${usersToTag}`,
  );
}
