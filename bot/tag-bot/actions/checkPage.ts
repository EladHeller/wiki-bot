import axios, { type AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { handlePage } from '../../maintenance/copyrightViolationCore';
import { logger } from '../../utilities/logger';
import { getExternalLinks, WikiLink } from '../../wiki/wikiLinkParser';
import { queuePlaywrightLinkCheck } from './playwrightLinkQueue';

type ExternalLinkClient = Pick<AxiosInstance, 'get'>;
type CheckedLink = WikiLink & { error: string };

const cookieAwareHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US,en;q=0.9,de;q=0.8,he;q=0.7,uk;q=0.6',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  priority: 'u=0, i',
  'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
  'sec-ch-ua-arch': '"arm"',
  'sec-ch-ua-bitness': '"64"',
  'sec-ch-ua-full-version': '"134.0.6998.89"',
  'sec-ch-ua-full-version-list': '"Chromium";v="134.0.6998.89", "Not:A-Brand";v="24.0.0.0", "Google Chrome";v="134.0.6998.89"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-model': '""',
  'sec-ch-ua-platform': '"macOS"',
  'sec-ch-ua-platform-version': '"15.3.2"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  Referrer: 'https://www.google.com',
};

function createExternalLinkClient(): ExternalLinkClient {
  const jar = new CookieJar();
  return wrapper(axios.create({
    jar,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
      ...cookieAwareHeaders,
    },
    validateStatus: () => true,
  }));
}

export async function checkExternalLinks(
  content: string,
  client?: ExternalLinkClient,
  queueContext?: {
    title: string;
    commentSummary: string;
    commentId: string;
  },
) {
  const resolvedClient = client ?? createExternalLinkClient();
  const brokenLinks: CheckedLink[] = [];
  const blockedLinks: WikiLink[] = [];
  const links = getExternalLinks(content);

  for (const link of links) {
    try {
      const res = await resolvedClient.get(link.link, {
        responseType: 'text',
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
      logger.logError(error);
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
      logger.logError(error);
      blockedLinks.forEach((link) => {
        brokenLinks.push({
          ...link,
          error: `לא ניתן להעביר לבדיקה ברקע - ${error instanceof Error ? error.message : String(error)}`,
        });
      });
    }
  }

  if (!brokenLinks.length) {
    return blockedLinks.length > 0
      ? `כל הקישורים שנגישים לבוט תקינים. קישורים שחסומים לבוט נשלחו לבדיקה ברקע: ${blockedLinks.map((link) => link.link).join(', ')}`
      : 'כל הקישורים תקינים';
  }
  const blockedMessage = blockedLinks.length > 0 ? 'חלק מהקישורים חסומים לבוט ונשלחו לבדיקה ברקע. ' : '';
  return `${blockedMessage}קישורים שבורים:\n${brokenLinks.map((brokenLink) => `* [${brokenLink.link} ${brokenLink.text}], ${brokenLink.error}`).join('\n')}`;
}

export async function checkCopyright(title: string) {
  const { logs, otherLogs } = await handlePage(title, !title.includes(':'));

  return logs.concat(otherLogs).map((log) => `* ${log}`).join('\n');
}
