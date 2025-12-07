import { escapeRegex } from '../utilities';
import { parseWikiStructures, nextWikiText } from './WikiParser';

type TemplateData = {
  arrayData?: string[];
  keyValueData?: Record<string, string>;
};

const isStructureInsideAnother = (
  inner: { start: number; end: number },
  outer: { start: number; end: number },
): boolean => inner.start > outer.start && inner.end <= outer.end;

export function findTemplates(text: string, templateName: string, title: string): string[] {
  const structures = parseWikiStructures(text, 0, title);
  const templateStart = `{{${templateName}`;
  const templateRegex = new RegExp(`^{{${escapeRegex(templateName)}\\s*[|}]`);

  const templateStructures = structures.filter((s) => s.type === 'template' || s.type === 'parameter');
  const skipRanges: Array<{ start: number; end: number }> = [];
  const matchingTemplates: string[] = [];

  templateStructures.forEach((structure) => {
    const insideSkippedRange = skipRanges.some((range) => isStructureInsideAnother(structure, range));

    if (insideSkippedRange) {
      return;
    }

    const templateText = text.substring(structure.start, structure.end);
    const startsWithName = templateText.startsWith(templateStart);

    if (startsWithName) {
      const matchesRegex = templateText.match(templateRegex);

      if (matchesRegex) {
        matchingTemplates.push(templateText);
      } else {
        skipRanges.push(structure);
      }
    }
  });

  return matchingTemplates;
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
  let templateStr = `{{${templateName}${endOfValue}`;

  Object.entries(data).forEach(([key, value]) => {
    templateStr += `|${key}=${value}${endOfValue}`;
  });
  templateStr += '}}';

  return templateStr;
}

export function getTemplateArrayData(
  templateText: string,
  templateName: string,
  title?: string,
  ignoreNamedParams = false,
): string[] {
  const templateContent = templateText.replace(`{{${templateName}`, '').replace(/}}$/, '');
  if (!templateContent.match(/^\s*\|/)) {
    return [];
  }
  let currIndex = nextWikiText(templateContent, 0, '|', false, title);
  let dataIndex = 0;
  const data: string[] = [];
  while (currIndex !== -1 && templateContent.length > 0) {
    currIndex += 1;
    const nextIndex = nextWikiText(templateContent, currIndex, '|', false, title);
    let value: string;
    if (nextIndex === -1) {
      value = templateContent.substring(currIndex).trim();
    } else {
      value = templateContent.substring(currIndex, nextIndex).trim();
    }
    const equalSignIndex = nextWikiText(value, 0, '=', false, title);
    if (!ignoreNamedParams || equalSignIndex === -1) {
      data[dataIndex] = value;
      dataIndex += 1;
    } else {
      const key = value.substring(0, equalSignIndex).trim();
      if (key.match('^[0-9]+$')) {
        data[Number(key) - 1] = value.substring(equalSignIndex + 1).trim();
      }
    }
    currIndex = nextIndex;
  }

  return data;
}

export function templateFromArrayData(data: string[], templateName: string): string {
  return `{{${templateName}|${data.join('|')}}}`;
}

export function getTemplateData(
  templateText: string,
  templateName: string,
  title: string,
): TemplateData {
  const templateContent = templateText.replace(`{{${templateName}`, '').replace(/}}$/, '');
  if (!templateContent.match(/^\s*\|/)) {
    return {};
  }
  let currIndex = nextWikiText(templateContent, 0, '|', false, title);
  let dataIndex = 0;
  const keyValueData: Record<string, string> = {};
  const arrayData: string[] = [];
  while (currIndex !== -1 && templateContent.length > 0) {
    currIndex += 1;
    const nextIndex = nextWikiText(templateContent, currIndex, '|', false, title);
    let value: string;
    if (nextIndex === -1) {
      value = templateContent.substring(currIndex).trim();
    } else {
      value = templateContent.substring(currIndex, nextIndex).trim();
    }
    const equalSignIndex = nextWikiText(value, 0, '=', false, title);
    if (equalSignIndex === -1) {
      arrayData[dataIndex] = value;
      dataIndex += 1;
    } else {
      const key = value.substring(0, equalSignIndex).trim();
      if (key.match(/^[0-9]+$/)) {
        arrayData[Number(key) - 1] = value.substring(equalSignIndex + 1).trim();
      } else {
        keyValueData[key] = value.substring(equalSignIndex + 1).trim();
      }
    }
    currIndex = nextIndex;
  }

  return {
    arrayData,
    keyValueData,
  };
}

export function templateFromTemplateData(templateData: TemplateData, templateName: string): string {
  let templateStr = `{{${templateName}`;
  if (templateData.arrayData) {
    templateStr += `|${templateData.arrayData.join('|')}`;
  }
  if (templateData.keyValueData) {
    Object.entries(templateData.keyValueData).forEach(([key, value]) => {
      templateStr += `|${key}=${value}`;
    });
  }
  return `${templateStr}}}`;
}
