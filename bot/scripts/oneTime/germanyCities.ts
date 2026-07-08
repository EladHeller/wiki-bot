import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import { findTemplate } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

async function handlePage(page: WikiPage, api: IWikiApi) {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    console.error(page.title, 'missing content or revision');
    return;
  }
  const template = findTemplate(content, 'עיר', page.title);
  if (!template) {
    return;
  }

  const newTemplate = template.replace('[[מדינות גרמניה|מדינה פדרלית]]', '[[מדינות גרמניה|מדינה בגרמניה]]');
  const newContent = content.replace(template, newTemplate);
  if (newContent !== content) {
    await api.edit(page.title, 'מדינה בפדרציה איננה מדינה פדרלית ([[מיוחד:הבדל/43528301|בקשה בוק:בב]])', newContent, revid);
  }
}

export default async function germanyCities() {
  const api = WikiApi();
  await api.login();
  const generator = api.search('insource:/\\[\\[מדינות גרמניה\\|מדינה פדרלית\\]\\]/');
  await asyncGeneratorMapWithSequence(10, generator, (page) => async () => {
    console.log(page.title);
    await handlePage(page, api);
  });
}
