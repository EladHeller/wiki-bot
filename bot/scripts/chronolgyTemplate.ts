import { asyncGeneratorMapWithSequence } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import { replaceValueWithDesignTemplate } from './utils';

// const TEMPLATE_NAME = 'סינגל';
const TEMPLATE_NAME = 'אלבום';
const CHRONOLOGY_TEMPLATE_NAME = 'כרונולוגיה';

const designTextRegex = /^\s*''([^'].*[^'])''\s*$/;
const doubleCheckDesignRegex = /''/g;
const quoteRegex = /^\s*"(.*)"\s*$/;
const doubleCheckQuoteRegex = /"/g;

export default async function chronologyTemplate() {
  const api = NewWikiApi();
  let number = 0;
  await api.login();
  const generator = api.getArticlesWithTemplate(`תבנית:${TEMPLATE_NAME}`);
  const titles = new Set<string>();
  await asyncGeneratorMapWithSequence(50, generator, (page) => async () => {
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
        const chronolgyTemplates = findTemplates(template, CHRONOLOGY_TEMPLATE_NAME, page.title);
        chronolgyTemplates.forEach((chronolgyTemplate) => {
          const data = getTemplateKeyValueData(chronolgyTemplate);
          const entries = Object.entries(data).map(([key, value]) => {
            let newValue = replaceValueWithDesignTemplate(
              page.title,
              quoteRegex,
              value,
              doubleCheckQuoteRegex,
            );
            newValue = replaceValueWithDesignTemplate(
              page.title,
              designTextRegex,
              value,
              doubleCheckDesignRegex,
            );
            if (newValue !== value) changed = true;
            return [key, newValue];
          });
          const newData = Object.fromEntries(entries);
          const text = templateFromKeyValueData(newData, CHRONOLOGY_TEMPLATE_NAME, false);
          newContent = newContent.replace(chronolgyTemplate, text);
        });
      });
      if (newContent !== content && changed) {
        await api.updateArticle(page.title, 'הסרת טקסט נטוי מתבנית כרונולוגיה', newContent);
        number += 1;
      }
    } catch (error) {
      console.log(error, page.title);
    }
  });
  console.log(number, titles.size);
}
