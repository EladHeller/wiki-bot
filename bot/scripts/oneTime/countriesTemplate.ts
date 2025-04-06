import { findTemplates } from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';

const flagsTemplate = [
  'דגלי מדינות אוקיאניה',
  'דגלי מדינות אירופה',
  'דגלי מדינות אמריקה הדרומית',
  'דגלי מדינות אמריקה הצפונית',
  'דגלי מדינות אסיה',
  'דגלי מדינות אפריקה',
];

const historyTemplate = [
  'היסטוריה של מדינות אוקיאניה',
  'היסטוריה של מדינות אירופה',
  'היסטוריה של מדינות אסיה',
  'היסטוריה של מדינות אפריקה',
  'היסטוריה של מדינות דרום אמריקה',
  'היסטוריה של מדינות המזרח התיכון',
  'היסטוריה של מדינות צפון אמריקה',
];

const symbolsTemplate = [
  'סמלי מדינות אוקיאניה',
  'סמלי מדינות אירופה',
  'סמלי מדינות אמריקה הדרומית',
  'סמלי מדינות אמריקה הצפונית',
  'סמלי מדינות אסיה',
  'סמלי מדינות אפריקה',
];

const anthemsTemplate = [
  'המנוני מדינות אוקיאניה',
  'המנוני מדינות אירופה',
  'המנוני מדינות אמריקה הדרומית',
  'המנוני מדינות אמריקה הצפונית',
  'המנוני מדינות אסיה',
  'המנוני מדינות אפריקה',
];

const replaces = {
  המנון: {
    old: anthemsTemplate,
    new: 'המנוני מדינות',
  },
  דגל: {
    old: flagsTemplate,
    new: 'דגלי מדינות',
  },
  היסטוריה: {
    old: historyTemplate,
    new: 'היסטוריית מדינות',
  },
  סמל: {
    old: symbolsTemplate,
    new: 'סמלי מדינות',
  },
};

function removeOldTemplatesFromPage(title: string, content: string): string {
  let newContent = content;
  for (const value of Object.values(replaces)) {
    const { old, new: newTemplate } = value;
    for (const template of old) {
      const thereIsTemplate = newContent.includes(`{{${newTemplate}}}`);
      newContent = newContent.replaceAll(`{{${template}}}`, thereIsTemplate ? '' : `{{${newTemplate}}}`);
    }
  }
  return newContent;
}

export default async function countriesTemplate() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');

  for (const [key, value] of Object.entries(replaces)) {
    const { old } = value;
    for (const template of old) {
      const generator = api.getArticlesWithTemplate(template);
      for await (const pages of generator) {
        for (const page of pages) {
          const revision = page.revisions?.[0];
          if (revision?.revid) {
            const content = revision.slots.main['*'];
            const newContent = removeOldTemplatesFromPage(page.title, content);
            if (newContent !== content) {
              await api.edit(page.title, `שינוי תבנית ${key}`, newContent, revision.revid);
            }
          }
        }
      }
    }
  }
}

export async function removeDuplicates() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');

  for (const value of Object.values(replaces)) {
    const { new: newTemplate } = value;
    const generator = api.getArticlesWithTemplate(newTemplate);
    for await (const pages of generator) {
      for (const page of pages) {
        const revision = page.revisions?.[0];
        if (revision?.revid) {
          const content = revision.slots.main['*'];
          let newContent = content;
          const templates = findTemplates(content, newTemplate, page.title);
          if (templates.length > 1) {
            for (let i = 1; i < templates.length; i += 1) {
              const template = templates[i];
              const newTemplateContent = content.replace(template, '');
              newContent = newTemplateContent;
            }
          }
          if (newContent !== content) {
            await api.edit(page.title, 'הסרת תבנית כפולה', newContent, revision.revid);
          }
        }
      }
    }
  }
}
