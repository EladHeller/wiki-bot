import shabathProtectorDecorator from '../decorators/shabathProtector';
import { WikiNotification } from '../types';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import { getAllParagraphs, getParagraphContent } from '../wiki/paragraphParser';
import { getInnerLinks } from '../wiki/wikiLinkParser';
import archiveParagraph from './actions/archive';

const whiteListPages = [
  'משתמש:החבלן',
  'שיחת משתמש:החבלן',
  'משתמש:Sapper-bot',
  'שיחת משתמש:Sapper-bot',
];

const TAG_PAGE_NAME = 'משתמש:Sapper-bot/בוט התיוג';

const notAllowedUserMessage = `אני מצטער, אבל אינך מורשה להשתמש בבוט. אנא קרא את ההוראות המפורטות בדף [[${TAG_PAGE_NAME}]] ולאחר מכן הוסף את שמך בפסקה "רשימת משתמשים".`;
const notSupportedCommandMessage = `מצטער, אבל הפקודה שהזנת לא נתמכת. אנא קרא את ההוראות המפורטות בדף [[${TAG_PAGE_NAME}]] ונסה שוב.`;
const supportedActions = ['ארכב'];

async function getAllowedUsers(api: IWikiApi) {
  const { content } = await api.articleContent(TAG_PAGE_NAME);
  const paragraphContent = getParagraphContent(content, 'רשימת משתמשים');
  if (!paragraphContent) {
    return [];
  }
  const users = getInnerLinks(paragraphContent);
  return users.map(({ link }) => link.replace('משתמש:', '').replace('user:', ''));
}

function getTimeStampOptions(timestamp: string) { // TODO: it's assumed that the Wikipedia is Hebrew
  const israelWinterDate = new Date(timestamp);
  israelWinterDate.setHours(israelWinterDate.getHours() + 2);
  const israelWinterTimestamp = israelWinterDate.toJSON();
  const israelSummerDate = new Date(timestamp);
  israelSummerDate.setHours(israelSummerDate.getHours() + 3);
  const israelSummerTimestamp = israelSummerDate.toJSON();
  return [israelWinterTimestamp, israelSummerTimestamp, timestamp];
}

export async function archiveAction(api: IWikiApi, notification: WikiNotification) {
  const title = notification.title.full;
  const user = notification.agent.name;
  const url = new URL(notification['*'].links.primary.url);
  const commentId = decodeURIComponent(url.hash.replace('#', ''));
  const timestamp = notification.timestamp.utciso8601;
  try {
    const pageContent = await api.articleContent(title);
    const paragraphs = getAllParagraphs(pageContent.content, title);
    const paragraphContent = paragraphs.find((paragraph) => paragraph.includes('@[[משתמש:Sapper-bot')
      && paragraph.includes('ארכב:')
      && paragraph.includes(user)
      && getTimeStampOptions(timestamp).some((time) => paragraph.includes(time)));
    if (!paragraphContent) {
      const commentRes = await api.addComment(title, `תגובה ל-[[משתמש:${user}]]`, 'לא נמצאה פסקה מתאימה לארכוב', commentId);
      console.log({ commentRes });
      return;
    }
    const res = await archiveParagraph(api, pageContent.content, pageContent.revid, title, paragraphContent, `ארכוב לבקשת [[משתמש:${user}]]`);
    if (res.error) {
      const commentRes = await api.addComment(title, `תגובה ל-[[משתמש:${user}]]`, `הארכוב נכשל: ${res.error}.`, commentId);
      console.log({ commentRes });
    }
  } catch (error) {
    console.error(error.message || error.data || error.toString());
    const commentRes = await api.addComment(title, `תגובה ל-[[משתמש:${user}]]`, notSupportedCommandMessage, commentId);
    console.log({ commentRes });
  }
}

const actions = {
  ארכב: archiveAction,
};

async function handleNotification(api: IWikiApi, notification: WikiNotification, allowedUsers: string[]) {
  if (notification.type !== 'mention' || notification.wiki !== 'hewiki') {
    return;
  }
  const url = new URL(notification['*'].links.primary.url);
  if (!url.hash) {
    console.log('No hash - probably not a talk page');
    return;
  }
  const title = notification.title.full;
  console.log({ title });
  const isInWhiteList = whiteListPages.some((whiteListTitle) => title.startsWith(whiteListTitle));
  if (!isInWhiteList) {
    console.log('Not in white list');
    return;
  }
  const { body } = notification['*'];
  console.log({ body });
  if (!body.trim().match(/^@(?:(?:משתמש|user):)?Sapper-bot/i)) {
    console.log('Not for bot');
    return;
  }
  const user = notification.agent.name;
  if (!allowedUsers.includes(user)) {
    const commentRes = await api.addComment(title, `תגובה ל-[[משתמש:${user}]]`, notAllowedUserMessage, decodeURIComponent(url.hash.replace('#', '')));
    console.log({ commentRes });

    return;
  }
  const withoutTag = body.replace(/@?Sapper-bot/i, '').trim();
  const command = withoutTag.split(':')[0];
  if (!supportedActions.includes(command)) {
    const commentRes = await api.addComment(title, `תגובה ל-[[משתמש:${user}]]`, notSupportedCommandMessage, decodeURIComponent(url.hash.replace('#', '')));
    console.log({ commentRes });
    return;
  }
  const action = actions[command];
  await action(api, notification);
}

export default async function tagBot() {
  const api = NewWikiApi();
  await api.login();
  const allowedUsers = await getAllowedUsers(api);
  const notificationsRes = await api.getNotifications();
  const markReadRes = await api.markRead();
  console.log({ markReadRes });
  const { notifications } = notificationsRes.query;
  for (const notification of notifications.list) {
    await handleNotification(api, notification, allowedUsers);
  }
}

export const main = shabathProtectorDecorator(tagBot);
