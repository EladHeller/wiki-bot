import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../../utilities';
import NewWikiApi from '../../wiki/NewWikiApi';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';

const TEMPLATE_NAME = 'ערוץ7';

export default async function innTemplate() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.getArticlesWithTemplate(TEMPLATE_NAME);
  let number = 0;
  await asyncGeneratorMapWithSequence<WikiPage>(25, generator, (page) => async () => {
    number += 1;
    if (number % 100 === 0) {
      console.log(number);
    }
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log(`No content for page ${page.title}`);
      return;
    }
    const templates = findTemplates(content, TEMPLATE_NAME, page.title);
    let newContent = content;
    await promiseSequence(5, templates.map((template) => async () => {
      const [author, title, id,, section] = getTemplateArrayData(
        template,
        TEMPLATE_NAME,
        page.title,
        true,
      );
      if (!id) {
        console.log(`No id for page ${page.title}`);
        return;
      }
      if (section === 'News/Flash') {
        const newTemplate = template.replace('News/Flash', 'flashes');
        newContent = newContent.replace(template, newTemplate);
        return;
      }

      if (section && section.toLocaleLowerCase() !== 'news' && section !== 'flashes') {
        const url = `https://www.inn.co.il/${section}.aspx/${id}`;
        try {
          const result = await fetch(url);
          if (result.status !== 200) {
            console.log(`Error fetching ${url}`, result.status, `[[${page.title}]]`, author, title);
          } else {
            console.log(`Success fetching ${url}`, result.url, `[[${page.title}]]`, author, title);
          }
        } catch (e) {
          console.log(`Error fetching ${url}`, `[[${page.title}]]`, author, title, e.message || e.data || e.toString());
        }
      }
    }));
    if (newContent !== content) {
      // await api.updateArticle(page.title, 'ערוץ7: פורמט חדש של פרמטר מדור', newContent);
      console.log(`Updated page ${page.title}`);
    }
  });
  console.log('Done', number);
}
