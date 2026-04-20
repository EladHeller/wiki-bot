import { ArticleLog } from '../admin/types';
import { WikiPage } from '../types';
import { asyncGeneratorMapWithSequence } from '../utilities';
import { logger, stringify } from '../utilities/logger';
import {
  findTemplates,
  getTemplateKeyValueData,
  templateFromKeyValueData,
} from '../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';

const TEMPLATE_NAME = 'מידע';
const TEMPLATE_PREFIX = 'תבנית';
const FILE_NAMESPACE = '6';
const EDIT_SUMMARY = 'ניקוי ערכי "אין" ו"לא ידוע" בתבנית מידע';
const TARGET_PARAMETERS = ['תיאור', 'מקור', 'יוצר'] as const;
const INVALID_VALUES = new Set(['אין', 'לא ידוע']);

function shouldClearValue(value: string | undefined): boolean {
  if (value == null || value === '') {
    return false;
  }

  return INVALID_VALUES.has(value.trim());
}

export function processTemplate(template: string): string | null {
  const keyValueData = getTemplateKeyValueData(template);
  const updatedData: Record<string, string> = { ...keyValueData };
  let changed = false;

  for (const param of TARGET_PARAMETERS) {
    if (shouldClearValue(keyValueData[param])) {
      updatedData[param] = '';
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  return templateFromKeyValueData(updatedData, TEMPLATE_NAME);
}

export async function processArticle(api: IWikiApi, page: WikiPage): Promise<ArticleLog | null> {
  try {
    const originalContent = page.revisions?.[0]?.slots.main['*'];
    const revid = page.revisions?.[0]?.revid;
    if (!originalContent || !revid) {
      logger.logWarning(`No content or revid for ${page.title}`);
      return null;
    }

    const templates = findTemplates(originalContent, TEMPLATE_NAME, page.title);
    let updatedContent = originalContent;
    let hasChanges = false;

    for (const template of templates) {
      const updatedTemplate = processTemplate(template);
      if (updatedTemplate) {
        updatedContent = updatedContent.replace(template, updatedTemplate);
        hasChanges = true;
      }
    }

    if (hasChanges && updatedContent !== originalContent) {
      await api.edit(page.title, EDIT_SUMMARY, updatedContent, revid);
      return { title: page.title, text: `[[:${page.title}]]` };
    }
    return null;
  } catch (err) {
    logger.logError(`Failed to update ${page.title}: ${stringify(err)}`);
    return { title: page.title, text: `[[${page.title}]]`, error: true };
  }
}

export default async function informationTemplateCleanupModel(apiInstance?: IWikiApi) {
  const api = apiInstance || WikiApi();
  await api.login();

  let processedCount = 0;
  const logs: ArticleLog[] = [];

  await asyncGeneratorMapWithSequence(
    50,
    api.getArticlesWithTemplate(TEMPLATE_NAME, undefined, TEMPLATE_PREFIX, FILE_NAMESPACE),
    (page) => async () => {
      const log = await processArticle(api, page);
      if (log) {
        logs.push(log);
      }
      processedCount += 1;
    },
  );

  return {
    logs,
    processedCount,
  };
}
