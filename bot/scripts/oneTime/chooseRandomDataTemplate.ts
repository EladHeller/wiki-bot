import { asyncGeneratorMapWithSequence } from '../../utilities';
import {
  findTemplates, getTemplateArrayData, templateFromArrayData,
} from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';

const oldTemplateName = 'בחירת מידע/אקראי';
const newTemplateName = 'בחירת מידע';

export default async function chooseRandomDataTemplate() {
  const api = WikiApi();
  await api.login();
  const generator = api.getArticlesWithTemplate(oldTemplateName, undefined, 'תבנית', '*');
  let pagesCount = 0;
  let editsCount = 0;
  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    pagesCount += 1;
    const revid = page.revisions?.[0].revid;
    const content = page.revisions?.[0].slots.main['*'];
    if (!revid || !content) {
      console.log(`No revid or content for ${page.title}`, { revid: !!revid, content: !!content });
      return;
    }
    const templates = findTemplates(content, oldTemplateName, page.title);
    if (templates.length === 0) {
      console.log(`No template found for ${page.title}`);
      return;
    }

    let newContent = content;
    templates.forEach((template) => {
      const templateData = getTemplateArrayData(template, oldTemplateName, page.title);
      templateData.push('תדירות החלפה=אקראי');
      const newTemplate = templateFromArrayData(templateData, newTemplateName);
      newContent = newContent.replace(template, newTemplate);
    });
    if (newContent === content) {
      console.log(`No change for ${page.title}`);
      return;
    }
    const editSummary = `החלפת תבנית ${oldTemplateName} בתבנית ${newTemplateName}`;
    console.log(`Editing ${page.title} with summary: ${editSummary}`);
    await api.edit(page.title, 'החלפת תבנית בחירת מידע', newContent, revid);
    editsCount += 1;
  });
  console.log({
    pagesCount,
    editsCount,
  });
}
