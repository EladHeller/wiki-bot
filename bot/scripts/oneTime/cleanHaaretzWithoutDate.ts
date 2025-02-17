import { asyncGeneratorMapWithSequence } from '../../utilities';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';
import { getParagraphContent } from '../../wiki/paragraphParser';

export default async function cleanHaaretzWithoutDate() {
  const api = WikiApi();
  await api.login();

  await asyncGeneratorMapWithSequence(10, api.categroyPages('שגיאות פרמטריות בתבנית הארץ - ללא תאריך'), (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('No content for', page.title);
      return;
    }
    const revid = page.revisions?.[0].revid;
    if (!revid) {
      console.log('No revid for', page.title);
      return;
    }
    let newContent = content;
    const templates = findTemplates(content, 'הארץ', page.title);
    let isExternalLinksChanged = false;
    templates.forEach((template) => {
      const arrayData = getTemplateArrayData(template, 'הארץ', page.title);
      if (arrayData.length < 4 || arrayData[3] === '') {
        const regexTemplate = template.replaceAll('{{', '\\{\\{').replaceAll('}}', '\\}\\}').replaceAll('|', '\\|').replaceAll('.', '\\.')
          .replaceAll('(', '\\(')
          .replaceAll(')', '\\)');
        const notActiveLinkRegex = '(?: ?\\{\\{קישור שבור\\}\\})';

        newContent = newContent.replace(new RegExp(`\\* ?${regexTemplate}\\.?${notActiveLinkRegex}\\n`, 'g'), '');
        newContent = newContent.replace(new RegExp(`\\n${regexTemplate}\\.?${notActiveLinkRegex}\\n`, 'g'), '\n');
        newContent = newContent.replace(new RegExp(`\\}\\}${regexTemplate}\\.?${notActiveLinkRegex}\\{\\{`, 'g'), '}}{{');
        isExternalLinksChanged = newContent !== content;
        newContent = newContent.replace(new RegExp(`\\{\\{הערה\\|(?:1=)?${regexTemplate}\\.?${notActiveLinkRegex}(?:\\|כיוון=(?:ימין|שמאל))?\\}\\}`), '');
        newContent = newContent.replace(new RegExp(`<ref>${regexTemplate}\\.?${notActiveLinkRegex}</ref>`), '');
      }
    });

    if (newContent !== content) {
      if (isExternalLinksChanged) {
        const externalLinkParagraphContent = getParagraphContent(content, 'קישורים חיצוניים', page.title);
        if (!externalLinkParagraphContent?.includes('{{') || !externalLinkParagraphContent?.includes('* ')) {
          console.error('empty external links paragraph', page.title);
          return;
        }
      }

      await api.edit(page.title, 'הסרת תבנית הארץ ללא תאריך', newContent, revid);
      console.log('Changed', page.title);
    }
  });
}
