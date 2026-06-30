import { handlePage } from '../../maintenance/copyrightViolationCore';
import { getExternalLinks, WikiLink } from '../../wiki/wikiLinkParser';

export async function checkExternalLinks(content: string) {
  const brokenLinks: (WikiLink & { error: string })[] = [];
  const links = getExternalLinks(content);

  for (const link of links) {
    try {
      const res = await fetch(link.link, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
      });
      if (res.status >= 400) {
        brokenLinks.push({
          ...link,
          error: `לא ניתן להגיע לקישור - ${res.status} - ${res.statusText}`,
        });
      }
    } catch (error) {
      console.log(error);
      brokenLinks.push({
        ...link,
        error: error.message,
      });
    }
  }
  if (!brokenLinks.length) {
    return 'כל הקישורים תקינים';
  }
  return `קישורים שבורים:\n${brokenLinks.map((brokenLink) => `* [${brokenLink.link} ${brokenLink.text}], ${brokenLink.error}`).join('\n')}`;
}

export async function checkCopyright(title: string) {
  const { logs, otherLogs } = await handlePage(title, !title.includes(':'));

  return logs.concat(otherLogs).map((log) => `* ${log}`).join('\n');
}
