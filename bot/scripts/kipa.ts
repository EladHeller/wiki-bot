import 'dotenv/config';
import {
  getArticleWithKipaTemplate, login, updateArticle,
} from '../wiki/wikiAPI';
import { promiseSequence } from '../utilities';
import { findTemplates } from '../wiki/newTemplateParser';

const TEMPLATE_NAME = 'כיפה';
const url = 'https://www.kipa.co.il/';

async function fixParameters(content: string, title: string): Promise<string> {
  let newContent = content;
  const templates = findTemplates(content, TEMPLATE_NAME, title);
  if (!templates.length) {
    console.log('no template', title);
  }
  await Promise.all(templates.map(async (template) => {
    const parameters = template.replace(`{{${TEMPLATE_NAME}|`, '').replace('}}', '').split('|');
    if (parameters[2].match(/^[0-9a-zA-Z]+(?:\/[0-9a-zA-Z]*)+$/)) {
      const res = await fetch(`${url}${parameters[2]}${!parameters[2].startsWith('ask') ? '.html' : ''}`);
      const newUrl = decodeURIComponent(res.url.replace(url, ''));
      if (newUrl) {
        parameters[2] = decodeURIComponent(res.url.replace(url, ''));
        newContent = newContent.replace(template, `{{${TEMPLATE_NAME}|${parameters.join('|')}}}`);
      } else {
        console.log('no new url', title);
      }
    }
  }));
  return newContent;
}

async function main() {
  await login();
  const results = await getArticleWithKipaTemplate();
  console.log(results.length);

  await promiseSequence(10, results.map((result) => async () => {
    try {
      const content = result.revisions?.[0].slots.main['*'];
      if (!content || !result.title) {
        console.log('no content', result.title);
        return;
      }
      const newContent = await fixParameters(content, result.title);
      if (newContent === content) {
        return;
      }
      await updateArticle(result.title, 'תיקון פרמטרים לתבנית כיפה', newContent);
      console.log(result.title, 'updated');
    } catch (error) {
      console.log(result.title, error?.data || error?.message || error?.toString());
    }
  }));
}

main();
