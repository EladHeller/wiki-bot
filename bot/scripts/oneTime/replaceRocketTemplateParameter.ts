import { asyncGeneratorMapWithSequence } from '../../utilities';
import { findTemplates, getTemplateKeyValueData, templateFromKeyValueData } from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';

const TEMPLATE_NAME = 'טיל';
export default async function replaceRocketTemplateParameter() {
  const api = WikiApi();
  await api.login();

  const generator = api.categroyPages('שגיאות פרמטריות בתבנית טיל');
  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    const content = page.revisions?.[0]?.slots.main['*'];
    const revid = page.revisions?.[0]?.revid;
    if (!revid) {
      console.log(`No revid for ${page.title}`);
      return;
    }
    if (!content) {
      console.log(`No content for ${page.title}`);
      return;
    }
    let newContent = content;
    const templates = findTemplates(content, TEMPLATE_NAME, page.title);
    if (!templates) {
      return;
    }
    for (const template of templates) {
      const keyValueData = getTemplateKeyValueData(template);
      if (keyValueData['ארץ ייצור']) {
        keyValueData['מדינת מקור'] = keyValueData['ארץ ייצור'];
        delete keyValueData['ארץ ייצור'];
        const newTemplate = templateFromKeyValueData(keyValueData, TEMPLATE_NAME);
        newContent = newContent.replace(template, newTemplate);
      }
    }
    if (newContent !== content) {
      await api.edit(page.title, newContent, `החלפת פרמטר בתבנית ${TEMPLATE_NAME}`, revid);
      console.log(`Updated ${page.title}`);
    }
  });
}
