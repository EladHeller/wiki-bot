import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import { findTemplate } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

async function handlePage(page: WikiPage, api: IWikiApi) {
  const content = page.revisions?.[0].slots.main['*'];
  const revision = page.revisions?.[0].revid;
  if (!content || !revision) {
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
    await api.edit(page.title, 'מדינה בפדרציה איננה מדינה פדרלית ([[מיוחד:הבדל/43528301|בקשה בוק:בב]])', newContent, revision);
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
