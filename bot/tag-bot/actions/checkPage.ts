import { handlePage } from '../../maintenance/copyrightViolationCore';
import { getExternalLinks, WikiLink } from '../../wiki/wikiLinkParser';
import { queuePlaywrightLinkCheck } from './playwrightLinkQueue';

type CheckedLink = WikiLink & { error: string };

export async function checkExternalLinks(
  content: string,
  queueContext?: {
    title: string;
    commentSummary: string;
    commentId: string;
  },
) {
  const brokenLinks: CheckedLink[] = [];
  const blockedLinks: WikiLink[] = [];
  const links = getExternalLinks(content);

  for (const link of links) {
    try {
      const res = await fetch(link.link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
      });
      if (res.status === 403) {
        blockedLinks.push(link);
      } else if (res.status >= 400) {
        brokenLinks.push({
          ...link,
          error: `לא ניתן להגיע לקישור - ${res.status} - ${res.statusText}`,
        });
      }
    } catch (error) {
      console.error(error);
      brokenLinks.push({
        ...link,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (blockedLinks.length > 0) {
    try {
      await queuePlaywrightLinkCheck({
        title: queueContext?.title ?? '',
        commentSummary: queueContext?.commentSummary ?? '',
        commentId: queueContext?.commentId ?? '',
        links: blockedLinks,
      });
    } catch (error) {
      console.error(error);
      blockedLinks.forEach((link) => {
        brokenLinks.push({
          ...link,
          error: `לא ניתן להעביר לבדיקה ברקע - ${error instanceof Error ? error.message : String(error)}`,
        });
      });
    }
  }
  console.log({ blockedLinks });

  if (!brokenLinks.length) {
    return blockedLinks.length > 0
      ? 'כל הקישורים שנגישים לבוט תקינים. קישורים שחסומים לבוט נשלחו לבדיקה ברקע.'
      : 'כל הקישורים תקינים';
  }
  const blockedMessage = blockedLinks.length > 0 ? 'חלק מהקישורים חסומים לבוט ונשלחו לבדיקה ברקע. ' : '';
  return `${blockedMessage}קישורים שבורים:\n${brokenLinks.map((brokenLink) => `* [${brokenLink.link} ${brokenLink.text}], ${brokenLink.error}`).join('\n')}`;
}

export async function checkCopyright(title: string) {
  const { logs, otherLogs } = await handlePage(title, !title.includes(':'));

  return logs.concat(otherLogs).map((log) => `* ${log}`).join('\n');
}
