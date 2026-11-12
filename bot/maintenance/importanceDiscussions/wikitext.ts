import { findTemplates, getTemplateData } from '../../wiki/newTemplateParser';
import { getAllParagraphs } from '../../wiki/paragraphParser';
import { parseWikiStructures } from '../../wiki/WikiParser';

export const templateNames = ['הבהרת חשיבות עם זמן', 'חשיבות', 'הבהרת חשיבות'];

export function importanceTemplates(content: string, title: string) {
  return templateNames.flatMap((name) => ['', 'תבנית:', 'Template:'].flatMap((prefix) => {
    const fullName = `${prefix}${name}`;
    return findTemplates(content.replaceAll('_', ' '), fullName, title)
      .map((text) => ({ text, data: getTemplateData(text, fullName, title) }));
  }));
}

function discussionText(content: string, title: string) {
  const normalized = content.replaceAll('_', ' ');
  const withoutTemplates = importanceTemplates(normalized, title)
    .reduce((text, template) => text.replace(template.text, ''), normalized);
  return parseWikiStructures(withoutTemplates, 0, title)
    .filter(({ type }) => ['comment', 'nowiki', 'math'].includes(type))
    .sort((a, b) => b.start - a.start)
    .reduce((text, { start, end }) => text.slice(0, start) + text.slice(end), withoutTemplates);
}

export function assessDiscussion(before: string, after: string, title: string): 'none' | 'existing' | 'uncertain' {
  if (getAllParagraphs(after, title).some((part) => importanceTemplates(part, title).length)) {
    return 'existing';
  }
  const oldText = discussionText(before, title);
  const newText = discussionText(after, title);
  const oldParagraphs = getAllParagraphs(oldText, title);
  const newParagraphs = getAllParagraphs(newText, title);
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  const oldParts = new Set([oldText.split(oldParagraphs[0] ?? '\0')[0], ...oldParagraphs].map(normalize));
  const newParts = [newText.split(newParagraphs[0] ?? '\0')[0], ...newParagraphs]
    .map(normalize).filter((part) => part && !oldParts.has(part));
  if (newParts.some((part) => /חשיבות/.test(part))) return 'existing';
  return newParts.length ? 'uncertain' : 'none';
}

export function matchesPlacementDate(date: string | undefined, timestamp: string) {
  return !date || date.split('.').map(Number).join('.')
    === new Date(timestamp).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

export function discussionMessage(title: string, user: string, timestamp: string, revisionId: number) {
  const date = new Date(timestamp).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  return `<!-- importance-discussion:${revisionId} -->\n`
    + `בערך [[${title}]] הוצבה תבנית חשיבות ל־7 ימים החל מ־${date} על ידי [[משתמש:${user}]]. `
    + `[[מיוחד:הבדל/${revisionId}|העריכה שבה הוצבה התבנית]].\n`
    + 'מניח התבנית מוזמן לנמק את הספק בחשיבותו האנציקלופדית של הערך. ~~~~';
}
