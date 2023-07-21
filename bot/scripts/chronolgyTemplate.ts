import { asyncGeneratorMapWithSequence } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';

const TEMPLATE_NAME = 'סינגל';
const CHROMOLOGU_TEMPLATE_NAME = 'כרונולוגיה';

export default async function chronologyTemplate() {
  const api = NewWikiApi();
  let number = 0;
  await api.login();
  const generator = api.getArticlesWithTemplate(`תבנית:${TEMPLATE_NAME}`);
  const titles = new Set<string>();
  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    try {
      const content = page.revisions?.[0].slots.main['*'];
      if (!content) {
        return;
      }
      if (titles.has(page.title)) {
        console.log(page.title, 'Double!');
      }
      titles.add(page.title);
      let newContent = content;
      const templates = findTemplates(content, TEMPLATE_NAME, page.title);
      let changed = false;
      templates.forEach((template) => {
        const chronolgyTemplates = findTemplates(template, CHROMOLOGU_TEMPLATE_NAME, page.title);
        chronolgyTemplates.forEach((chronolgyTemplate) => {
          const data = getTemplateKeyValueData(chronolgyTemplate);
          const entries = Object.entries(data).map(([key, value]) => {
            const newValue = value.replace(/^\s*''([^'].*[^'])''\s*$/, '$1');
            if (newValue !== value) changed = true;
            return [key, newValue];
          });
          const newData = Object.fromEntries(entries);
          const text = templateFromKeyValueData(newData, 'כרונולוגיה', false);
          newContent = newContent.replace(chronolgyTemplate, text);
        });
      });
      if (newContent !== content && changed) {
        await api.updateArticle(page.title, 'הסרת טקסט נטוי מתבנית כרונולוגיה', newContent);
        // console.log(page.title, 'success');
        number += 1;
        //   } else {
        //     console.log(page.title, 'skipped');
      }
    } catch (error) {
      console.log(error, page.title);
    }
  });
  console.log(number, titles.size);
}
