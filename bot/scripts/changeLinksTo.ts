import { WikiPage } from '../types';
import { asyncGeneratorMapWithSequence } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import { getInnerLinks } from '../wiki/wikiLinkParser';

export default async function changeLinksTo(
  currentTarget: string,
  newTarget: string,
  reason: string,
  saveText = true,
) {
  const api = NewWikiApi();
  await api.login();
  const generator = api.backlinksTo(currentTarget);

  await asyncGeneratorMapWithSequence<WikiPage>(1, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      return;
    }
    const innerLinks = getInnerLinks(content);
    const releventLinks = innerLinks.filter((x) => x.link === currentTarget);
    if (releventLinks.length === 0) {
      console.log('Missing link', page.title);
      return;
    }
    let newContent = content;
    releventLinks.forEach((link) => {
      const isTextDifferent = link.text !== link.link;
      const oldLink = isTextDifferent ? `[[${link.link}|${link.text}]]` : `[[${link.link}]]`;
      const newLink = (isTextDifferent || saveText) ? `[[${newTarget}|${link.text}]]` : `[[${newTarget}]]`;
      newContent = newContent.replace(oldLink, newLink);
    });
    if (newContent === content) {
      console.log('No change', page.title);
      return;
    }
    try {
      await api.updateArticle(page.title, reason, newContent);
      console.log('Edited', page.title);
    } catch (error) {
      console.log('Error', page.title, error?.data || error?.message || error?.toString());
    }
  });
}
