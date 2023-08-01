import { asyncGeneratorMapWithSequence } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import {
  findTemplates, getTemplateArrayData, getTemplateKeyValueData, templateFromKeyValueData,
} from '../wiki/newTemplateParser';

const designTemplates = [
  'משמאל לימין',
  'ללא גלישה',
  'שי',
];

function replaceValueWithDesignTemplate(
  pageTitle: string,
  regex: RegExp,
  text: string,
  doubleCheckRegex?: RegExp,
) {
  let newValue = text.replace(regex, '$1');

  designTemplates.forEach((designTemplate) => {
    const designTemplateContents = findTemplates(text, designTemplate, pageTitle);
    designTemplateContents.forEach((designTemplateContent) => {
      const [designContent] = getTemplateArrayData(designTemplateContent, designTemplate);
      const newDesignContent = designContent.replace(regex, '$1');
      if (designContent !== newDesignContent) {
        const newTemplateContent = designTemplateContent.replace(
          designContent,
          newDesignContent,
        );
        newValue = newValue.replace(designTemplateContent, newTemplateContent);
      }
    });
  });
  if (doubleCheckRegex) {
    const doubleCheckMatches = newValue.match(doubleCheckRegex);
    if (doubleCheckMatches && doubleCheckMatches.length > 1) {
      console.log(`* [[${pageTitle}]]`);
      return text;
    }
  }
  return newValue;
}

const designTextRegex = /^\s*''([^'].*[^'])''\s*$/;
const doubleCheckDesignRegex = /''/g;
const quoteRegex = /^\s*"(.*)"\s*$/;
const doubleCheckQuoteRegex = /"/g;

export async function first(templateName = 'סינגלי אלבום') {
  const api = NewWikiApi();
  let number = 0;
  await api.login();
  const generator = api.getArticlesWithTemplate(`תבנית:${templateName}`);
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
      const templates = findTemplates(content, templateName, page.title);
      let changed = false;
      templates.forEach((template) => {
        const data = getTemplateKeyValueData(template);
        if (data['ללא עיצוב']) {
          console.log(page.title, 'ללא עיצוב');
          return;
        }
        const newData = JSON.parse(JSON.stringify(data));
        const name = newData['שם']?.trim();
        if (name) {
          const newValue = replaceValueWithDesignTemplate(
            page.title,
            designTextRegex,
            name,
            doubleCheckDesignRegex,
          );
          if (newValue !== name) {
            newData['שם'] = newValue;
            changed = true;
          }
        }
        Object.entries(newData).forEach(([key, value]) => {
          if (key.match(/סינגל\d{1,2}/)) {
            const newValue = replaceValueWithDesignTemplate(
              page.title,
              quoteRegex,
              value as string,
            );
            if (newValue !== value) {
              newData[key] = newValue;
              changed = true;
            }
          }
        });
        const text = templateFromKeyValueData(newData, templateName, false);
        newContent = newContent.replace(template, text);
      });
      if (newContent !== content && changed) {
        await api.updateArticle(page.title, `הסרת עיצוב מתבנית ${templateName}`, newContent);
        number += 1;
      }
    } catch (error) {
      console.log(error, page.title);
    }
  });
  console.log(number, titles.size);
}

export async function second(templateName = 'אלבום') {
  const api = NewWikiApi();
  let number = 0;
  await api.login();
  const generator = api.getArticlesWithTemplate(`תבנית:${templateName}`);
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
      const templates = findTemplates(content, templateName, page.title);
      let changed = false;
      templates.forEach((template) => {
        const data = getTemplateKeyValueData(template);
        if (data['ללא עיצוב']) {
          console.log(page.title, 'ללא עיצוב');
          return;
        }
        const newData = JSON.parse(JSON.stringify(data));
        const name = newData['שם']?.trim();
        if (name) {
          const newValue = replaceValueWithDesignTemplate(
            page.title,
            designTextRegex,
            name,
            doubleCheckDesignRegex,
          );
          if (newValue !== name) {
            newData['שם'] = newValue;
            changed = true;
          }
        }
        Object.entries(newData).forEach(([key, value]) => {
          if (key.match(/סינגל\d{1,2}/)) {
            const newValue = replaceValueWithDesignTemplate(
              page.title,
              quoteRegex,
              value as string,
              doubleCheckQuoteRegex,
            );
            if (newValue !== value) {
              newData[key] = newValue;
              changed = true;
            }
          }
        });
        const text = templateFromKeyValueData(newData, templateName);
        newContent = newContent.replace(template, text);
      });
      if (newContent !== content && changed) {
        await api.updateArticle(page.title, `הסרת עיצוב מתבנית ${templateName}`, newContent);
        number += 1;
      }
    } catch (error) {
      console.log(error, page.title);
    }
  });
  console.log(number, titles.size);
}

export async function third(templateName = 'סינגל') {
  const api = NewWikiApi();
  let number = 0;
  await api.login();
  const generator = api.getArticlesWithTemplate(`תבנית:${templateName}`);
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
      const templates = findTemplates(content, templateName, page.title);
      let changed = false;
      templates.forEach((template) => {
        const data = getTemplateKeyValueData(template);
        if (data['ללא עיצוב']) {
          console.log(page.title, 'ללא עיצוב');
          return;
        }
        const newData = JSON.parse(JSON.stringify(data));
        const name = newData['שם']?.trim();
        if (name) {
          const newValue = replaceValueWithDesignTemplate(
            page.title,
            quoteRegex,
            name,
            doubleCheckQuoteRegex,
          );
          if (newValue !== name) {
            newData['שם'] = newValue;
            changed = true;
          }
        }

        const sourceName = newData['שם בשפת המקור']?.trim();
        if (sourceName) {
          const newValue = replaceValueWithDesignTemplate(
            page.title,
            quoteRegex,
            sourceName,
            doubleCheckQuoteRegex,
          );
          if (newValue !== sourceName) {
            newData['שם בשפת המקור'] = newValue;
            changed = true;
          }
        }

        const album = newData['אלבום']?.trim();
        if (album) {
          const newValue = replaceValueWithDesignTemplate(
            page.title,
            designTextRegex,
            album,
            doubleCheckDesignRegex,
          );
          if (newValue !== album) {
            newData['אלבום'] = newValue;
            changed = true;
          }
        }

        const text = templateFromKeyValueData(newData, templateName);
        newContent = newContent.replace(template, text);
      });
      if (newContent !== content && changed) {
        await api.updateArticle(page.title, `הסרת עיצוב מתבנית ${templateName}`, newContent);
        number += 1;
      }
    } catch (error) {
      console.log(error, page.title);
    }
  });
  console.log(number, titles.size);
}

export default {
  first,
};
