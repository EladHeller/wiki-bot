import readline from 'readline';
import { findTemplates } from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function getConfirm(title: string) {
  return new Promise((resolve) => {
    rl.question(`Are you want to update ${title} (y/n)? `, (answer) => {
      const normalized = answer.trim().toLowerCase();
      const confirmed = normalized.toLocaleLowerCase() === 'y' || normalized.toLocaleLowerCase() === 'yes';
      resolve(confirmed);
    });
  });
}

export default async function removeTemplate(templateName: string, summary = `הסרה של תבנית:${templateName}`) {
  const api = WikiApi();
  await api.login();
  const generator = api.getArticlesWithTemplate(templateName, undefined, 'תבנית', '*');
  for await (const pages of generator) {
    for (const page of pages) {
      const content = page.revisions?.[0].slots.main['*'];
      const revid = page.revisions?.[0].revid;
      if (!revid || !content) {
        console.error(`missing revid or content for page ${page.title}`, { revid, content });
        throw new Error('Missing revid or content');
      }
      const templates = findTemplates(content, templateName, page.title);
      let newContent = content;
      for (const template of templates) {
        newContent = newContent.replace(`${template}\n\n`, '');
        newContent = newContent.replace(`${template}\n`, '');
        newContent = newContent.replace(template, '');
      }

      if (newContent !== content) {
        const confirmed = await getConfirm(page.title);
        if (confirmed) {
          console.log(`Updating ${page.title}`);
          await api.edit(page.title, summary, newContent, revid);
        } else {
          console.log(`Not updating ${page.title}`);
        }
      }
    }
  }
  rl.close();
}
