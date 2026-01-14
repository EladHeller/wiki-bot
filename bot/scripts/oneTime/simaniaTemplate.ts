import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';

const TEMPLATE_NAME = 'סימניה סופר';
const ALTERNATE_TEMPLATE_NAME = 'סימניה';

async function searchSimania(author: string, currentId: string, title: string) {
  const response = await fetch(`https://simania.co.il/api/search?query=${encodeURIComponent(author)}&page=1`);
  const data = await response.json();

  const id = data?.data?.entities?.[0]?.lowestBookId;
  const authorName = data?.data?.entities?.[0]?.name;
  const isEqual = authorName && (authorName === author
    || (author.includes(authorName) && authorName.length > 8)
    || (authorName.includes(author) && author.length > 8));
  if (id === currentId) {
    if (!isEqual) {
      console.error(`${title}: Current author name ${authorName} does not match ${author}`);
    }
    return id;
  }

  if (!isEqual) {
    console.error(`${title}:Author name ${authorName} does not match ${author}`);
    return null;
  }
  const pageResponse = await fetch(`https://simania.co.il/authorDetails.php?itemId=${id}`);
  if (pageResponse.status !== 200) {
    console.error(`Error to fetch page for ${title}, status: ${pageResponse.status}`);
    return null;
  }
  return id;
}

async function handleTemplate(template: string, title: string, templateName: string) {
  const [oldId, author] = getTemplateArrayData(template, templateName, title);
  const titleWithoutBraces = title.replace(/ \(.*\)/, '');
  const id = await searchSimania(author || titleWithoutBraces, oldId, title);
  if (!id) {
    return template;
  }
  return template.replace(oldId, id);
}

export default async function simaniaTemplate() {
  const api = WikiApi();
  await api.login();
  const generator = api.getArticlesWithTemplate(TEMPLATE_NAME);

  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    const revid = page.revisions?.[0].revid;
    const content = page.revisions?.[0].slots?.main['*'];
    if (!content || !revid) {
      console.error(`No content or revid for ${page.title}`);
      return;
    }
    let newContent = content;
    const templates = findTemplates(content, TEMPLATE_NAME, page.title);
    for (const template of templates) {
      const newTemplateContent = await handleTemplate(template, page.title, TEMPLATE_NAME);
      newContent = newContent.replace(template, newTemplateContent);
    }
    const alternateTemplates = findTemplates(content, ALTERNATE_TEMPLATE_NAME, page.title);
    for (const template of alternateTemplates) {
      const newTemplateContent = await handleTemplate(template, page.title, ALTERNATE_TEMPLATE_NAME);
      newContent = newContent.replace(template, newTemplateContent);
    }
    if (!templates.length && !alternateTemplates.length) {
      console.log(`No templates found for ${page.title}`);
      return;
    }
    if (newContent !== content) {
      await api.edit(page.title, 'עדכון תבנית סימניה לפי הפורמט החדש ([[מיוחד:הבדל/42535218|בקשה בוק:בב]])', newContent, revid);
    }
  });
}
