import { WikiPage } from '../types';
import { asyncGeneratorMapWithSequence } from '../utilities';
import { findTemplates, getTemplateArrayData, templateFromArrayData } from '../wiki/newTemplateParser';
import WikiApi from '../wiki/WikiApi';
import { getInnerLinks } from '../wiki/wikiLinkParser';

export default async function changeLinksTo(
  currentTarget: string,
  newTarget: string,
  reason: string,
  saveText = true,
  isCategory = false,
  isTemplate = false,
) {
  const api = WikiApi();
  await api.login();

  const generator = isCategory ? api.categroyPages(currentTarget.replace('קטגוריה:', ''))
    : api.backlinksTo(currentTarget, '*');

  await asyncGeneratorMapWithSequence<WikiPage>(10, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!content || !revid) {
      console.error('Missing content or revid', page.title);
      return;
    }
    const innerLinks = getInnerLinks(content);
    const releventLinks = innerLinks.filter((x) => x.link === currentTarget);
    const longTemplates = isTemplate ? findTemplates(content, 'תבנית', page.title)
      .filter((x) => x.includes(currentTarget.replace('תבנית:', '').replace('תב:', ''))) : [];
    const shortTemplates = isTemplate ? findTemplates(content, 'תב', page.title)
      .filter((x) => x.includes(currentTarget.replace('תבנית:', '').replace('תב:', ''))) : [];

    if (releventLinks.length === 0 && longTemplates.length === 0 && shortTemplates.length === 0) {
      console.log('Missing link', page.title);
      return;
    }
    let newContent = content;
    releventLinks.forEach((link) => {
      const isTextDifferent = link.text !== link.link;
      const oldLink = isTextDifferent ? `[[${link.link}|${link.text}]]` : `[[${link.link}]]`;
      const newLink = (isTextDifferent || saveText) ? `[[${newTarget}|${link.text}]]` : `[[${newTarget}]]`;
      newContent = newContent.replace(oldLink, newLink);
    });
    longTemplates.forEach((template) => {
      const arrayData = getTemplateArrayData(template, 'תב', page.title);
      arrayData[0] = newTarget.replace('תבנית:', '').replace('תב:', '');
      const newTemplate = templateFromArrayData(arrayData, 'תבנית');
      newContent = newContent.replace(template, newTemplate);
    });
    shortTemplates.forEach((template) => {
      const arrayData = getTemplateArrayData(template, 'תב', page.title);
      arrayData[0] = newTarget.replace('תבנית:', '').replace('תב:', '');
      const newTemplate = templateFromArrayData(arrayData, 'תב');
      newContent = newContent.replace(template, newTemplate);
    });
    if (newContent === content) {
      console.log('No change', page.title);
      return;
    }
    try {
      await api.edit(page.title, reason, newContent, revid);
      console.log('Edited', page.title);
    } catch (error) {
      console.log('Error', page.title, error?.data || error?.message || error?.toString());
    }
  });
}
