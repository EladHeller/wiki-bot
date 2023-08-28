import { nextWikiText } from './WikiParser';

export function findTemplates(text: string, templateName: string, title: string): string[] {
  const templates: string[] = [];
  let currIndex = 0;
  let templateStartIndex = 0;
  let templateEndIndex = 0;
  const templateStart = `{{${templateName}`;
  while (currIndex < text.length) {
    templateStartIndex = text.substring(currIndex).indexOf(templateStart);
    if (templateStartIndex === -1) {
      break;
    }
    templateStartIndex = currIndex + templateStartIndex;
    templateEndIndex = nextWikiText(text, templateStartIndex + templateStart.length, '}}');
    if (templateEndIndex === -1) {
      console.log('Error: template end not found', title);
      break;
    }
    templates.push(text.substring(templateStartIndex, templateEndIndex + 2));
    currIndex = templateEndIndex + 2;
  }
  return templates;
}

export function findTemplate(text: string, templateName: string, title: string): string {
  const templates = findTemplates(text, templateName, title);
  return templates.length ? templates[0] : '';
}

export function getTemplateKeyValueData(templateText: string): Record<string, string> {
  const obj = {};
  if (templateText) {
    let currIndex = templateText.indexOf('|') + 1;

    let isTemplateEnd = false;
    while (!isTemplateEnd) {
      let value: string;
      const equalSignIndex = templateText.indexOf('=', currIndex);
      const key = templateText.substring(currIndex, equalSignIndex).trim();
      const pipeSignIndex = nextWikiText(templateText, currIndex, '|');
      isTemplateEnd = pipeSignIndex === -1;

      if (isTemplateEnd) {
        value = templateText.substring(equalSignIndex + 1, templateText.length - 2).trim();
      } else {
        value = templateText.substring(equalSignIndex + 1, pipeSignIndex).trim();
      }

      obj[key] = value;
      currIndex = pipeSignIndex + 1;
    }
  }
  return obj;
}

export function templateFromKeyValueData(
  data: Record<string, string>,
  templateName: string,
  newLines = true,
): string {
  const endOfValue = newLines ? '\n' : '';
  let tamplateStr = `{{${templateName}${endOfValue}`;

  Object.entries(data).forEach(([key, value]) => {
    tamplateStr += `|${key}=${value}${endOfValue}`;
  });
  tamplateStr += '}}';

  return tamplateStr;
}

export function getTemplateArrayData(
  templateText: string,
  templateName: string,
  title?: string,
): string[] {
  const templateContent = templateText.replace(`{{${templateName}`, '').replace(/}}$/, '');
  let currIndex = nextWikiText(templateContent, 0, '|', false, title);
  const data: string[] = [];
  while (currIndex !== -1 && templateContent.length > 0) {
    currIndex += 1;
    const nextIndex = nextWikiText(templateContent, currIndex, '|', false, title);
    if (nextIndex === -1) {
      data.push(templateContent.substring(currIndex).trim());
    } else {
      data.push(templateContent.substring(currIndex, nextIndex).trim());
    }
    currIndex = nextIndex;
  }

  return data;
}

export function templateFromArrayData(data: string[], templateName: string): string {
  return `{{${templateName}|${data.join('|')}}}`;
}
