import { asyncGeneratorMapWithSequence } from '../utilities';
import WikiApi from '../wiki/WikiApi';
import { getInnerLinks } from '../wiki/wikiLinkParser';

const statistics = {
  totalPages: 0,
  updatedPages: 0,
  errorPages: 0,
};
// await replaceLinkWithLanguageLink('קבוצות דיון', 'אנגלית', 'Usenet', 'קבוצת דיון');
export default async function replaceLinkWithLanguageLink(
  articleName: string,
  externalLanguage: string,
  externalArticleName: string,
  rightArticleName?: string,
) {
  const api = WikiApi();
  await api.login();
  const generartor = api.backlinksTo(articleName, '0');

  await asyncGeneratorMapWithSequence(1, generartor, (page) => async () => {
    statistics.totalPages += 1;
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('No content for', page.title);
      return;
    }
    const revid = page.revisions?.[0].revid;
    if (!revid) {
      console.log('No revid for', page.title);
      return;
    }
    let newContent = content;
    const links = getInnerLinks(content);
    links.forEach((link) => {
      if (link.link === articleName) {
        if (link.params) {
          statistics.errorPages += 1;
          console.error('link with params', link);
          return;
        }
        const textDiffers = link.text !== link.link;
        newContent = newContent.replace(
          `[[${link.link}${textDiffers ? `|${link.text}` : ''}]]`,
          `{{קישור שפה|${externalLanguage}|${externalArticleName}|${rightArticleName || link.link}${textDiffers || rightArticleName ? `|${link.text}` : ''}}}`,
        );
      }
    });
    if (newContent === content) {
      console.log('no change', page.title);
      return;
    }
    try {
      statistics.updatedPages += 1;
      await api.edit(page.title, 'החלפת קישור פנימי אדום בתבנית קישור שפה', newContent, revid);
    } catch (error) {
      statistics.errorPages += 1;
      console.log(error?.data || error?.message || error?.toString());
    }
  });
  console.log('Pages:', statistics.totalPages);
  console.log('Updated:', statistics.updatedPages);
  console.log('Errors:', statistics.errorPages);
}
