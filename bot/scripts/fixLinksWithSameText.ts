import { WikiPage } from '../types';
import { contentFromPage } from '../utilities';
import { getInnerLinks } from '../wiki/wikiLinkParser';

export default function fixLinksWithSameText(page: WikiPage): string | null {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    return null;
  }
  const innerLinks = getInnerLinks(content);
  const releventLinks = innerLinks.filter((x) => x.text === x.link);
  if (releventLinks.length === 0) {
    return null;
  }
  const newContent = releventLinks.reduce((currContent, link) => currContent.replace(`[[${link.link}|${link.text}]]`, `[[${link.link}]]`), content);

  if (newContent === content) {
    return null;
  }
  return newContent;
}
