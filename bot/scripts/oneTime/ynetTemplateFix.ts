import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';

const TEMPLATE_NAME = 'ynet';

export default async function ynetTemplateFix() {
  const api = WikiApi();
  await api.login();

  const generator = api.getArticlesWithTemplate(TEMPLATE_NAME);

  await asyncGeneratorMapWithSequence(25, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!content || !revid) {
      throw new Error(`Missing content or revid ${page.title}`);
    }
    let newContent = content;

    const ynetTemplates = findTemplates(content, TEMPLATE_NAME, page.title);
    ynetTemplates.forEach((ynetTemplate) => {
      const templateData = getTemplateArrayData(ynetTemplate, TEMPLATE_NAME, page.title);
      const id = templateData[2];
      const newId = id.replace(/articles\/\d,\d+,\w-(\d+),\d+\.html/, '$1');
      if (id !== newId) {
        const newTemplate = ynetTemplate.replace(id, newId);
        newContent = newContent.replace(ynetTemplate, newTemplate);
      }
      if (newId.includes('?')) {
        const newTemplate = ynetTemplate.replace(newId, newId.replace(/\?.*$/, ''));
        newContent = newContent.replace(ynetTemplate, newTemplate);
      }
    });

    if (newContent !== content) {
      await api.edit(page.title, 'תבנית ynet - תיקון מזהה כתבה', newContent, revid);
      console.log('Updated', page.title);
    }
  });
}
