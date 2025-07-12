import WikiApi from '../../wiki/WikiApi';
import { findTemplates, getTemplateArrayData, templateFromArrayData } from '../../wiki/newTemplateParser';
import { getInnerLinks } from '../../wiki/wikiLinkParser';

export default async function fixFlagTemplateIssues() {
  const api = WikiApi();
  await api.login();

  const listTitle = 'משתמש:Sapper-bot/בעיות בתבנית דגל';
  const { content } = await api.articleContent(listTitle);
  const pageLinks = getInnerLinks(content);
  for (const { link: title } of pageLinks) {
    try {
      const { content: originalContent, revid } = await api.articleContent(title);

      const templates = findTemplates(originalContent, 'דגל', title);
      let updatedContent = originalContent;
      let changed = false;

      for (const template of templates) {
        const after = originalContent.split(template)[1];
        const match = after?.match(/^\s*\[\[([^\]]+)\]\]/);

        if (match) {
          const link = match[1];
          const params = getTemplateArrayData(template, 'דגל', title);
          const country = params[0];

          if (country === link) {
            if (params.length < 3) {
              while (params.length < 2) params.push('');
              params[2] = '+';
            } else if (params[2] !== '+') {
              params[2] = '+';
            }

            const newTemplate = templateFromArrayData(params, 'דגל');
            const oldSyntax = `${template}${match[0]}`;
            updatedContent = updatedContent.replace(oldSyntax, newTemplate);
            changed = true;
          }
        }
      }

      if (changed && updatedContent !== originalContent) {
        await api.edit(title, 'תבנית דגל - העברת הקישור לתבנית באמצעות פרמטר +', updatedContent, revid);
        console.log(`✅ Updated: ${title}`);
      }
    } catch (err) {
      console.error(`⚠️ Failed to update ${title}`, err);
    }
  }
}
