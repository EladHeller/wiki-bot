import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../../utilities';
import NewWikiApi from '../../wiki/NewWikiApi';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';

const templateName = 'בשבע';
export default async function beshevaToInn() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.getArticlesWithTemplate(templateName, undefined, 'תבנית', '*');

  const number = 0;
  await asyncGeneratorMapWithSequence<WikiPage>(5, generator, (page) => async () => {
    const content = page.revisions?.[0]?.slots.main['*'];
    if (!content) {
      console.log(`No content for page ${page.title}`);
      return;
    }
    let newContent = content;
    const templates = findTemplates(content, templateName, page.title);
    await promiseSequence(1, templates.map((template) => async () => {
      const [author, title, id, date] = getTemplateArrayData(
        template,
        templateName,
        page.title,
        true,
      );
      let actualDate = date;
      if (date) {
        const withLinkMatch = date.match(/^[הב]?\[?\[?(\d{1,2})[בן,]? ?ב?([א-ת]{3,9})\]?\]?,? ?\[?\[?(\d{4})\]?\]?[.,]?$/);
        if (withLinkMatch) {
          actualDate = `${withLinkMatch[1]} ב${withLinkMatch[2]} ${withLinkMatch[3]}`;
        }
      }

      if (!id || !title) {
        console.log(`No id or title for page ${page.title}`, template);
        return;
      }
      const url = `https://www.inn.co.il/Besheva/Article.aspx/${id}`;

      const res = await fetch(url);
      if (res.status !== 200) {
        console.log(`Error fetching ${url}`, res.status, `[[${page.title}]]`, title, author);
        return;
      }

      // https://www.inn.co.il/news/558774
      const match = res.url.match(/inn\.co\.il\/news\/([0-9]+)$/);
      if (!match) {
        console.log('Not news', res.url, url, `[[${page.title}]]`);
        return;
      }

      const newTemplate = `{{ערוץ7|${author ?? ''}|${title ?? ''}|${match[1] ?? ''}|${actualDate ?? ''}}}`;
      newContent = newContent.replace(template, newTemplate);
    }));
    if (newContent !== content) {
      await api.updateArticle(page.title, 'החלפת תבנית בשבע בתבנית ערוץ 7', newContent);
      console.log('success', page.title);
    }
  });

  console.log('Done', number);
}
