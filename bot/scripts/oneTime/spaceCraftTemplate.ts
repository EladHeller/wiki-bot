/* eslint-disable no-loop-func */
import { asyncGeneratorMapWithSequence } from '../../utilities';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';

const TEMPLATE_NAME = 'רכב חלל';

export default async function spaceCraftTemplate() {
  const api = WikiApi();
  await api.login();

  const generator = api.getArticlesWithTemplate(TEMPLATE_NAME);
  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    const content = page.revisions?.[0]?.slots.main['*'];
    const revId = page.revisions?.[0]?.revid;
    if (!content || !revId) {
      return;
    }
    let newContent = content;
    let hasChanges = false;
    const templates = findTemplates(content, TEMPLATE_NAME, page.title);
    for (const template of templates) {
      const templateData = getTemplateKeyValueData(template);
      if (templateData['משקל']) {
        hasChanges = true;
        templateData['משקל כולל'] = templateData['משקל'];
        delete templateData['משקל'];
      }
      Object.entries(templateData).forEach(([key, value]) => {
        if (!value?.trim()) {
          hasChanges = true;
          delete templateData[key];
        }
      });
      const newTemplate = templateFromKeyValueData(templateData, TEMPLATE_NAME);
      newContent = newContent.replace(template, newTemplate);
    }
    if (newContent !== content && hasChanges) {
      await api.edit(page.title, 'בוט - תיקון תבנית רכב חלל ([[מיוחד:הבדל/43281029|דיון על התבנית]], [[מיוחד:הבדל/43281192|בקשה בוק:בב]])', newContent, revId);
    }
  });
}
