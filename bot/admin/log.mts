import { getLocalDate } from '../utilities';
import { findTemplates, getTemplateArrayData } from '../wiki/newTemplateParser';
import { getParagraphContent, getUsersFromTagParagraph } from '../wiki/paragraphParser';
import { getArticleContent, updateArticle } from '../wiki/wikiAPI';
import { getInnerLinks } from '../wiki/wikiLinkParser';
import { ArticleLog, Paragraph } from './types';

const tagsPage = 'משתמש:Sapper-bot/תיוג משתמשים';

function isParagraphArray(logs: ArticleLog[] | Paragraph[]) : logs is Paragraph[] {
  const firstElement = logs[0];

  return firstElement && 'content' in firstElement && 'name' in firstElement;
}

function getContentFromLogs(logs: ArticleLog[]): string {
  if (!logs.length) {
    return '';
  }
  return `* ${logs.map(({ text }) => text).join('\n* ')}\n`;
}

function getContentFromNeedProtectLogs(logs: ArticleLog[]): string {
  if (!logs.length) {
    return '';
  }

  return `* ${logs.map(({ title, text }) => `{{בקשת הגנה|${title}|${text}}}`).join('\n* ')}\n`;
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

const REQUEST_PROTECTION_TEMPLATE_NAME = 'בקשת הגנה';
export function filterDuplicateLog(logs: ArticleLog[], logPageTitle: string, articleContent = ''): ArticleLog[] {
  const requestProtectionTemplates = findTemplates(
    articleContent,
    REQUEST_PROTECTION_TEMPLATE_NAME,
    logPageTitle,
  ).map(
    (template) => getTemplateArrayData(template, REQUEST_PROTECTION_TEMPLATE_NAME, logPageTitle),
  );
  const innerLinks = getInnerLinks(articleContent);
  const withoutLinks = logs.filter((log) => !innerLinks.some(({ link }) => link === log.title));
  if (!requestProtectionTemplates.length) {
    return withoutLinks;
  }
  return withoutLinks.filter(
    (log) => !requestProtectionTemplates.some(([file]) => file === log.title),
  );
}

function parseLogs(
  logs: ArticleLog[],
  logPageTitle: string,
  subParagraphCode: string,
  logPageContent = '',
) {
  const success = logs.filter((log) => !log.error && !log.skipped && !log.needProtection);
  const errors = logs.filter((log) => log.error);
  const skipped = filterDuplicateLog(
    logs.filter((log) => log.skipped),
    logPageTitle,
    logPageContent,
  );
  const needProtection = filterDuplicateLog(
    logs.filter((log) => log.needProtection),
    logPageTitle,
    logPageContent,
  );

  if (!success.length && !errors.length && !skipped.length && !needProtection.length) {
    return '';
  }

  const successContent = getContentFromLogs(success);
  const errorContent = `${errors.length ? `${subParagraphCode}שגיאות${subParagraphCode}\n` : ''}${getContentFromLogs(errors)}`;
  const skippedContent = `${skipped.length ? `${subParagraphCode}דפים שדולגו${subParagraphCode}\n` : ''}${getContentFromLogs(skipped)}`;
  const needProtectionContent = `${needProtection.length ? `${subParagraphCode}דפים בעמוד הראשי שזקוקים להגנה${subParagraphCode}\n` : ''}${getContentFromNeedProtectLogs(needProtection)}`;

  return `${successContent}${errorContent}${skippedContent}${needProtectionContent}`;
}

function parseParagraphs(logs: Paragraph[], subParagraphCode: string) {
  return logs.reduce((acc, { content, name }) => `${acc}${subParagraphCode}${name}${subParagraphCode}\n${content}\n`, '');
}

export default async function writeAdminBotLogs(
  logs: ArticleLog[] | Paragraph[],
  logPageTitle: string,
) {
  const logPageContent = await getArticleContent(logPageTitle);
  const titleAndSummary = `לוג ריצה ${getLocalDate(new Date().toLocaleString())}`;
  const nightRun = isNightRun(titleAndSummary, logPageContent);
  const title = nightRun ? '===ריצת ערב===' : `==${titleAndSummary}==`;

  const subParagraphCode = nightRun ? '====' : '===';

  const content = isParagraphArray(logs) ? parseParagraphs(logs, subParagraphCode)
    : parseLogs(logs, logPageTitle, subParagraphCode, logPageContent);

  if (!content.length) {
    return;
  }
  const adminUsersToTag = await getAdminUsersToTag();
  const specificUsersToTag = await getUsersToTagFromSpecialPage(logPageContent);

  const usersToTag = `${[...new Set([...adminUsersToTag, ...specificUsersToTag])].join(', ')} לידיעתכם. ~~~~`;
  await updateArticle(
    logPageTitle,
    titleAndSummary,
    `${logPageContent}ֿ\n${title}\n${content}\n${usersToTag}`,
  );
}
