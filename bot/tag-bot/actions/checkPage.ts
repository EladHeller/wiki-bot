import { handlePage } from '../../maintenance/copyrightViolationCore';
import { getExternalLinks, WikiLink } from '../../wiki/wikiLinkParser';

export async function checkExternalLinks(content: string) {
  const brokenLinks: WikiLink[] = [];
  const links = getExternalLinks(content);

  for (const link of links) {
    try {
      const res = await fetch(link.link);
      if (res.status >= 400) {
        brokenLinks.push(link);
      }
    } catch (error) {
      console.log(error);
      brokenLinks.push(link);
    }
  }
  if (!brokenLinks.length) {
    return 'כל הקישורים תקינים';
  }
  return `קישורים שבורים:\n
    ${brokenLinks.map((brokenLink) => `* [${brokenLink.link} ${brokenLink.text}]`).join('\n')}`;
}

export async function checkCopyright(title: string) {
  const { logs, otherLogs } = await handlePage(title, !title.includes(':'));

  return logs.concat(otherLogs).map((log) => `* ${log}`).join('\n');
}
