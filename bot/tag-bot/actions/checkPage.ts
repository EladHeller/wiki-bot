import { handlePage } from '../../maintenance/copyrightViolationCore';
import { logger } from '../../utilities/logger';
import { getExternalLinks, WikiLink } from '../../wiki/wikiLinkParser';
import { checkLinksWithHttp, LinkCheckResult, LinkCheckState } from './externalLinkChecker';
import { lookupIABotLinks } from './internetArchiveBot';
import { queuePlaywrightLinkCheck } from './playwrightLinkQueue';

type CheckedLink = WikiLink & { error: string };

function formatCheckError(result: LinkCheckResult): string {
  if (result.error) {
    return result.error;
  }
  if (result.status) {
    return `לא ניתן להגיע לקישור - ${result.status} - ${result.statusText ?? ''}`;
  }
  return 'לא ניתן לקבוע אם הקישור תקין';
}

export async function checkExternalLinks(
  content: string,
  queueContext?: {
    title: string;
    commentSummary: string;
    commentId: string;
  },
) {
  const links = getExternalLinks(content);
  const httpResults = await checkLinksWithHttp(links, queueContext?.title);
  const unresolvedLinks = links.filter((link) => httpResults.get(link.link)?.state !== 'alive');
  let iabotResults = new Map<string, LinkCheckState>();
  if (unresolvedLinks.length > 0) {
    try {
      iabotResults = await lookupIABotLinks(unresolvedLinks.map((link) => link.link));
    } catch (error) {
      logger.logWarning(error);
    }
  }
  const finalResults = links.map((link) => {
    const httpResult = httpResults.get(link.link) ?? { state: 'unknown' } satisfies LinkCheckResult;
    const iabotState = iabotResults.get(link.link);
    const state = iabotState === 'alive' || iabotState === 'dead' ? iabotState : httpResult.state;
    return { link, result: { ...httpResult, state } };
  });
  const brokenLinks: CheckedLink[] = finalResults
    .filter(({ result }) => result.state === 'dead')
    .map(({ link, result }) => ({ ...link, error: formatCheckError(result) }));
  const linksForBackgroundCheck = finalResults
    .filter(({ result }) => !['alive', 'dead'].includes(result.state))
    .map(({ link }) => link);
  const unverifiedLinks: CheckedLink[] = [];
  let queuedLinksCount = 0;
  if (linksForBackgroundCheck.length > 0) {
    try {
      await queuePlaywrightLinkCheck({
        title: queueContext?.title ?? '',
        commentSummary: queueContext?.commentSummary ?? '',
        commentId: queueContext?.commentId ?? '',
        links: linksForBackgroundCheck,
      });
      queuedLinksCount = linksForBackgroundCheck.length;
    } catch (error) {
      logger.logError(error);
      linksForBackgroundCheck.forEach((link) => {
        unverifiedLinks.push({
          ...link,
          error: `לא ניתן להעביר לבדיקה ברקע - ${error instanceof Error ? error.message : String(error)}`,
        });
      });
    }
  }
  console.log({
    externalLinkCheck: {
      total: links.length,
      broken: brokenLinks.length,
      queued: queuedLinksCount,
      unverified: unverifiedLinks.length,
    },
  });
  const messages: string[] = [];
  if (brokenLinks.length === 0 && unverifiedLinks.length === 0) {
    messages.push(queuedLinksCount > 0
      ? 'כל הקישורים שניתן היה לאמת תקינים. קישורים שלא ניתן היה לאמת נשלחו לבדיקה ברקע.'
      : 'כל הקישורים תקינים');
  } else if (queuedLinksCount > 0) {
    messages.push('קישורים שלא ניתן היה לאמת נשלחו לבדיקה ברקע.');
  }
  if (brokenLinks.length > 0) {
    messages.push(`קישורים שבורים:\n${brokenLinks.map((link) => `* [${link.link} ${link.text}], ${link.error}`).join('\n')}`);
  }
  if (unverifiedLinks.length > 0) {
    messages.push(`קישורים שלא ניתן היה לאמת:\n${unverifiedLinks.map((link) => `* [${link.link} ${link.text}], ${link.error}`).join('\n')}`);
  }
  return messages.join('\n');
}

export async function checkCopyright(title: string) {
  const { logs, otherLogs } = await handlePage(title, !title.includes(':'));

  return logs.concat(otherLogs).map((log) => `* ${log}`).join('\n');
}
