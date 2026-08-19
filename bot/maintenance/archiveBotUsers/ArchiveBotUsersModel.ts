import { IWikiApi } from '../../wiki/WikiApi';

const ARCHIVE_BOT_TEMPLATES = [
  'בוט ארכוב אוטומטי',
  'מחיקת הודעות תפוצה',
];
const USER_TALK_NAMESPACE = '3';
const TARGET_PAGE = 'תבנית:משתמשי בוט הארכוב';
const EDIT_SUMMARY = '[[ויקיפדיה:בוט/בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: עדכון רשימת משתמשי הבוט';
const HIDDEN_USERS_SPAN = /(<span[^>]*style\s*=\s*["'][^"']*display\s*:\s*none;?[^"']*["'][^>]*>)[\s\S]*?(<\/span>)/iu;

export interface IArchiveBotUsersModel {
  update(): Promise<void>;
}

export function replaceHiddenUsers(content: string, users: string[]): string {
  if (!HIDDEN_USERS_SPAN.test(content)) {
    throw new Error('Hidden archive bot users span not found');
  }

  const userLinks = users.map((user) => `[[משתמש:${user}]]`).join('');
  return content.replace(HIDDEN_USERS_SPAN, (_, openingTag: string, closingTag: string) => (
    `${openingTag}${userLinks}${closingTag}`
  ));
}

function userNameFromTalkPage(title: string): string {
  return title.slice(title.indexOf(':') + 1).split('/')[0];
}

export default function ArchiveBotUsersModel(wikiApi: IWikiApi): IArchiveBotUsersModel {
  async function getUsers(): Promise<string[]> {
    const users = new Set<string>();

    for (const template of ARCHIVE_BOT_TEMPLATES) {
      const generator = wikiApi.getArticlesWithTemplate(
        template,
        undefined,
        'תבנית',
        USER_TALK_NAMESPACE,
      );
      for await (const pages of generator) {
        pages.map((page) => userNameFromTalkPage(page.title)).forEach((user) => users.add(user));
      }
    }

    return [...users].sort(new Intl.Collator('he').compare);
  }

  async function update(): Promise<void> {
    const users = await getUsers();
    if (users.length === 0) {
      throw new Error('No archive bot users found');
    }

    const { content, revid } = await wikiApi.articleContent(TARGET_PAGE);
    const updatedContent = replaceHiddenUsers(content, users);
    if (updatedContent === content) {
      return;
    }

    await wikiApi.edit(TARGET_PAGE, EDIT_SUMMARY, updatedContent, revid, undefined, true);
  }

  return { update };
}
