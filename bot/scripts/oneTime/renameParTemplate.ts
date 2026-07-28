import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import { findTemplates } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const TEMPLATE_NAME = 'פר';
console.debug = () => { };

async function handlePage(api: IWikiApi, page: WikiPage) {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    console.error('missing revid or content', page.title);
    return;
  }
  let newContent = content;
  const templates = findTemplates(content, TEMPLATE_NAME, page.title);
  for (const template of templates) {
    const newTemplate = template.replace(/^({{\s*)פר(\s*[|}])/, '$1פרמטר$2');
    newContent = newContent.replace(template, newTemplate);
  }
  if (newContent !== content) {
    await api.edit(page.title, 'בוט - שינוי תבנית פר לתבנית פרמטר ([[מיוחד:הבדל/43647812|בקשה בוק:בב]], [[מיוחד:הבדל/43642105|דיון בוק:תב]])', newContent, revid);
  } else {
    console.log('not changed', page.title);
  }
}

export default async function renameParTemplate() {
  const api = WikiApi();
  await api.login();
  const generator = api.getArticlesWithTemplate(TEMPLATE_NAME, undefined, 'תבנית', '*');
  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    await handlePage(api, page);
  });
}
