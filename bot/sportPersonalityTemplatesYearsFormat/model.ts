/* eslint-disable no-loop-func */
import { ArticleLog } from '../admin/types';
import { WikiPage } from '../types';
import { asyncGeneratorMapWithSequence } from '../utilities';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import {
  findTemplates,
  getTemplateKeyValueData,
  templateFromKeyValueData,
} from '../wiki/newTemplateParser';

export type TemplateName = 'אישיות כדורגל' | 'אישיות כדורסל';

const TEMPLATE_NAMES: readonly TemplateName[] = ['אישיות כדורגל', 'אישיות כדורסל'];

const TEMPLATES_CONFIG: Record<TemplateName, string[]> = {
  'אישיות כדורגל': [
    'שנות נוער',
    'שנים כשחקן',
    'שנים בנבחרת כשחקן',
    'שנים כמאמן',
  ],
  'אישיות כדורסל': [
    'שנים כשחקן',
    'שנים כמאמן',
    'שנים כג\'נרל מנג\'ר',
  ],
};

export function fixYearRange(value: string): string {
  if (!value) return value;

  let result = value
    // הסרת קישורי שנים [[YYYY]] -> YYYY
    .replace(/\[\[(\d{4})\]\]/g, '$1')
    // החלפת מקפים רגילים בקו מפריד
    .replace(/(\d{4})\s*-\s*(\d{4})/g, '$1–$2')
    // הסרת רווחים סביב קו מפריד קיים
    .replace(/(\d{4})\s*–\s*(\d{4})/g, '$1–$2');

  // תיקון סדר שנים - הקטנה לפני הגדולה
  result = result.replace(/(\d{4})–(\d{4})/g, (match, year1, year2) => {
    const num1 = parseInt(year1, 10);
    const num2 = parseInt(year2, 10);
    if (num1 > num2) {
      return `${year2}–${year1}`;
    }
    return match;
  });

  return result;
}

export function processTemplate(template: string, templateName: TemplateName): string | null {
  const keyValueData = getTemplateKeyValueData(template);
  let changed = false;
  const updatedData: Record<string, string> = { ...keyValueData };

  const yearParameters = TEMPLATES_CONFIG[templateName];
  if (!yearParameters) {
    return null;
  }

  for (const param of yearParameters) {
    const originalValue = keyValueData[param];
    if (originalValue) {
      const fixedValue = fixYearRange(originalValue);
      if (fixedValue !== originalValue) {
        updatedData[param] = fixedValue;
        changed = true;
      }
    }
  }

  if (!changed) {
    return null;
  }

  return templateFromKeyValueData(updatedData, templateName);
}

export async function processArticle(
  api: IWikiApi,
  page: WikiPage,
): Promise<ArticleLog | null> {
  try {
    const originalContent = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!originalContent || !revid) {
      console.error(`No content or revid for ${page.title}`);
      return null;
    }
    let updatedContent = originalContent;
    let hasChanges = false;
    for (const templateName of TEMPLATE_NAMES) {
      const templates = findTemplates(originalContent, templateName, page.title);

      for (const template of templates) {
        const updatedTemplate = processTemplate(template, templateName);
        if (updatedTemplate) {
          updatedContent = updatedContent.replace(template, updatedTemplate);
          hasChanges = true;
        }
      }
    }

    if (hasChanges && updatedContent !== originalContent) {
      await api.edit(
        page.title,
        'תיקון עיצוב טווחי שנים בתבניות אישיות ספורט',
        updatedContent,
        revid,
      );
      console.log(`✅ Updated: ${page.title}`);
      return { title: page.title, text: `[[${page.title}]]` };
    }
    return null;
  } catch (err) {
    console.error(`⚠️ Failed to update ${page.title}`, err);
    return { title: page.title, text: `[[${page.title}]]`, error: true };
  }
}

export default async function sportPersonalityTemplatesYearsFormatModel(apiInstance?: IWikiApi) {
  const api = apiInstance || WikiApi();
  await api.login();

  let processedCount = 0;
  const logs: ArticleLog[] = [];

  for (const templateName of TEMPLATE_NAMES) {
    await asyncGeneratorMapWithSequence(50, api.getArticlesWithTemplate(templateName), (page) => async () => {
      const log = await processArticle(api, page);
      if (log) {
        logs.push(log);
      }
      processedCount += 1;
    });
  }

  return {
    logs,
    processedCount,
  };
}
