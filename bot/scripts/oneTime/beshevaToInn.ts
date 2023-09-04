import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../../utilities';
import NewWikiApi from '../../wiki/NewWikiApi';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';

const templateName = 'בשבע';
export default async function beshevaToInn() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.getArticlesWithTemplate(`תבנית:${templateName}`);

  const number = 0;
  await asyncGeneratorMapWithSequence<WikiPage>(25, generator, (page) => async () => {
    const content = page.revisions[0].slots.main['*'];
    if (!content) {
      console.log(`No content for page ${page.title}`);
      return;
    }
    let newContent = content;
    const templates = findTemplates(content, templateName, page.title);
    await promiseSequence(5, templates.map((template) => async () => {
      const [author, title, id, date] = getTemplateArrayData(
        template,
        templateName,
        page.title,
        true,
      );
      if (date) {
        if (date && !date.match(/\d{1,2} [א-ת]{3,10} \d{4}/)) {
          console.log(page.title, date);
        } else {
          console.log(page.title, 'good date');
        }
      }

      if (!id || !title) {
        console.log(`No id or title for page ${page.title}`, template);
        return;
      }
      const url = `https://www.inn.co.il/Besheva/Article.aspx/${id}`;

      const res = await fetch(url);
      if (res.status !== 200) {
        console.log(`Error fetching ${url}`, res.status, `[[${page.title}]]`);
        return;
      }

      // https://www.inn.co.il/news/558774
      if (!res.url.match(/inn\.co\.il\/news\/[0-9]+$/)) {
        console.log('Not news', res.url, url, `[[${page.title}]]`);
        return;
      }

      const newTemplate = `{{ערוץ7|${author ?? ''}|${title ?? ''}|${id ?? ''}|${date ?? ''}}}`;
      newContent = newContent.replace(template, newTemplate);
    }));
    if (newContent !== content) {
      console.log('success', page.title);
    } else {
    //   console.log('fail', page.title);
    }
  });

  console.log('Done', number);
}
