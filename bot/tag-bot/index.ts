import shabathProtectorDecorator from '../decorators/shabathProtector';
import { WikiNotification } from '../types';
import { getLocalTimeAndDate } from '../utilities';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import { getAllParagraphs, getParagraphContent } from '../wiki/paragraphParser';
import { getInnerLinks } from '../wiki/wikiLinkParser';
import archiveParagraph from './actions/archive';
import askGPT from './gpt-bot/askGPT';

const TAG_PAGE_NAME = 'משתמש:Sapper-bot/בוט התיוג';
const SUMMARY_PREFIX = `[[${TAG_PAGE_NAME}|בוט התיוג]]: `;

const failedMessage = 'שגיאה לא ידועה: [[משתמש:החבלן]], שים לב ותקן.';
const notAllowedUserMessage = `אני מצטער, אבל אינך מורשה להשתמש בבוט. אנא קרא את ההוראות המפורטות בדף [[${TAG_PAGE_NAME}]] ולאחר מכן הוסף את שמך בפסקה "רשימת משתמשים".`;
const notSupportedCommandMessage = `מצטער, אבל הפקודה שהזנת לא נתמכת. אנא קרא את ההוראות המפורטות בדף [[${TAG_PAGE_NAME}]] ונסה שוב.`;

type AllowedConfiguration = {
  users: string[];
  pages: string[];
};

async function getAllowedConfiguration(api: IWikiApi): Promise<AllowedConfiguration> {
  const { content } = await api.articleContent(TAG_PAGE_NAME);
  const usersParagraphContent = getParagraphContent(content, 'רשימת משתמשים');
  let users: string[] = [];
  if (usersParagraphContent) {
    users = getInnerLinks(usersParagraphContent).map(({ link }) => link.replace('משתמש:', '').replace('user:', ''));
  }

  const pagesParagraphContent = getParagraphContent(content, 'דפים נתמכים');
  const pages: string[] = [];
  if (pagesParagraphContent) {
    pagesParagraphContent.split('\n').forEach((line) => {
      if (!line.trim().startsWith('*')) {
        return;
      }
      const page = line.replace(/^\s*\*/, '').trim();
      if (page.startsWith('[[')) {
        const links = getInnerLinks(page);
        if (links.length === 1) {
          pages.push(links[0].link);
        }
      } else {
        pages.push(page);
      }
    });
  }
  return {
    users,
    pages,
  };
}

function getTimeStampOptions(timestamp: string) { // TODO: it's assumed that the Wikipedia is Hebrew
  const israelWinterDate = new Date(timestamp);
  israelWinterDate.setHours(israelWinterDate.getHours() + 2);
  const israelSummerDate = new Date(timestamp);
  israelSummerDate.setHours(israelSummerDate.getHours() + 3);

  const winterDateMinusMinute = new Date(israelWinterDate);
  winterDateMinusMinute.setMinutes(winterDateMinusMinute.getMinutes() - 1);
  const summerDateMinusMinute = new Date(israelSummerDate);
  summerDateMinusMinute.setMinutes(summerDateMinusMinute.getMinutes() - 1);
  const timestampMinusMinute = new Date(timestamp);
  timestampMinusMinute.setMinutes(timestampMinusMinute.getMinutes() - 1);
  return [
    israelWinterDate.toJSON(),
    israelSummerDate.toJSON(),
    winterDateMinusMinute.toJSON(),
    summerDateMinusMinute.toJSON(),
    timestampMinusMinute.toJSON(),
    timestamp,
  ].map((time) => getLocalTimeAndDate(time));
}

function getArchiveSummary(user: string) {
  return `${SUMMARY_PREFIX}ארכוב לבקשת [[משתמש:${user}|${user}]]`;
}

function getCommentSummary(user: string) {
  return `${SUMMARY_PREFIX}תגובה ל-[[משתמש:${user}|${user}]]`;
}

function getCommentPrefix(user: string) {
  return `@[[משתמש:${user}|${user}]] `;
}

export async function archiveAction(api: IWikiApi, notification: WikiNotification) {
  const title = notification.title.full;
  const user = notification.agent.name;
  const url = new URL(notification['*'].links.primary.url);
  const commentId = decodeURIComponent(url.hash.replace('#', ''));
  const timestamp = notification.timestamp.utciso8601;
  const archiveSummary = getArchiveSummary(user);
  const commentSummary = getCommentSummary(user);
  const commentPrefix = getCommentPrefix(user);
  try {
    const pageContent = await api.articleContent(title);
    const paragraphs = getAllParagraphs(pageContent.content, title);
    const paragraphContent = paragraphs.find((paragraph) => paragraph.match(/@\[\[(?:(?:משתמש|user):)?Sapper-bot/i)
      && paragraph.includes('ארכב:')
      && paragraph.includes(user)
      && getTimeStampOptions(timestamp).some((time) => paragraph.includes(time)));
    if (!paragraphContent) {
      const commentRes = await api.addComment(title, commentSummary, `${commentPrefix}לא נמצאה פסקה מתאימה לארכוב`, commentId);
      console.log({ commentRes });
      return;
    }
    const [, type, ...target] = notification['*'].body.split(':');
    const res = await archiveParagraph(
      api,
      pageContent.content,
      pageContent.revid,
      title,
      paragraphContent,
      archiveSummary,
      user,
      [type?.trim(), target.join(':').trim()],
    );
    if (res.error) {
      const commentRes = await api.addComment(title, commentSummary, `${commentPrefix}הארכוב נכשל: ${res.error}.`, commentId);
      console.log({ commentRes });
    }
  } catch (error) {
    console.error(error.message || error.data || error.toString());
    const commentRes = await api.addComment(title, commentSummary, failedMessage, commentId);
    console.log({ commentRes });
  }
}

async function askAction(api: IWikiApi, notification: WikiNotification) {
  const title = notification.title.full;
  const user = notification.agent.name;
  const commentSummary = getCommentSummary(user);
  const commentPrefix = getCommentPrefix(user);
  const url = new URL(notification['*'].links.primary.url);
  const commentId = decodeURIComponent(url.hash.replace('#', ''));

  try {
    const question = notification['*'].body.split(':')[1].trim();
    const response = await askGPT(question);

    const commentRes = await api.addComment(title, commentSummary, `${commentPrefix}\n${response}.`, commentId);
    console.log({ commentRes });
  } catch (error) {
    console.error('Failed to ask gpt', error.message || error.data || error.toString());
    const commentRes = await api.addComment(title, commentSummary, `${commentPrefix}${failedMessage}`, commentId);
    console.log({ commentRes });
  }
}

const actions = {
  ארכב: archiveAction,
  ענה: askAction,
};
const supportedActions = Object.keys(actions);

async function handleNotification(
  api: IWikiApi,
  notification: WikiNotification,
  allowedConfiguration: AllowedConfiguration,
) {
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
  const isInWhiteList = allowedConfiguration.pages.some((whiteListTitle) => title.startsWith(whiteListTitle));
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
  const commentSummary = getCommentSummary(user);
  const commentPrefix = getCommentPrefix(user);
  const withoutTag = body.replace(/@?Sapper-bot/i, '').trim();
  console.log({ withoutTag });
  if (!withoutTag.includes(':')) {
    console.log('Probably it is just mention?');
    return;
  }

  if (!allowedConfiguration.users.includes(user)) {
    const commentRes = await api.addComment(title, commentSummary, commentPrefix + notAllowedUserMessage, decodeURIComponent(url.hash.replace('#', '')));
    console.log({ commentRes });

    return;
  }

  const [command] = withoutTag.split(':');
  console.log({ command });
  if (!supportedActions.includes(command)) {
    const commentRes = await api.addComment(title, commentSummary, commentPrefix + notSupportedCommandMessage, decodeURIComponent(url.hash.replace('#', '')));
    console.log({ commentRes });
    return;
  }
  const action = actions[command];
  await action(api, notification);
}

async function saveNotification(api: IWikiApi, notification: WikiNotification) {
  try {
    const content = `@[[משתמש:החבלן]], שים לב: [${notification['*'].links.primary.url} ${notification['*'].links.primary.label}]. ~~~~`;
    const title = notification['*'].header;
    await api.edit('user:Sapper-bot/אימיילים', title, content, -1, title);
  } catch (e) {
    console.error('Failed to save notification', e);
  }
}

export default async function tagBot() {
  const api = WikiApi();
  await api.login();
  const allowedConfiguration = await getAllowedConfiguration(api);
  const notificationsRes = await api.getNotifications();
  const markReadRes = await api.markRead();
  console.log({ markReadRes });
  const { notifications } = notificationsRes.query;
  for (const notification of notifications.list) {
    await handleNotification(api, notification, allowedConfiguration);
    await saveNotification(api, notification);
  }
}

export const main = shabathProtectorDecorator(tagBot);
