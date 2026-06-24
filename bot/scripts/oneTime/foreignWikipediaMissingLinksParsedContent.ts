import { JSDOM } from 'jsdom';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import BaseWikiApi, { defaultConfig } from '../../wiki/BaseWikiApi';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import {
  findTemplates,
  getTemplateArrayData,
  getTemplateData,
  templateFromTemplateData,
} from '../../wiki/newTemplateParser';
import { getRedirectTargetFromContent } from '../../wiki/redirectParser';
import { WikiPage } from '../../types';

const CATEGORY_TITLE = 'קטגוריה:קישור לערך לא קיים בוויקיפדיה זרה';
const LOG_PAGE_TITLE = 'user:sapper-bot/קישורי שפה - הפניות - ריצה 5';
const EDIT_SUMMARY = 'תיקון קישורי שפה';
const VALIDATOR_ERROR_SELECTOR = '.paramvalidator-error';
const VALIDATOR_ERROR_REGEX = /שימוש בתבנית\s+(.+?)\s+עבור\s+"(.+?)"\s+בשפה\s+([a-z-]+)\s+אך ערך זה לא קיים בשפה זו/i;
const WATCHED_TEMPLATES = ['צרפ', 'גרמ', 'אנג', 'טורק', 'ייד'];

export type ParamValidatorError = {
  templateName: string;
  foreignTitle: string;
  languageCode: string;
};

type TemplateCheckLog = ParamValidatorError & {
  pageTitle: string;
  success: boolean;
  reason?: string;
  redirectTarget?: string;
};

const languageApis: Record<string, IWikiApi> = {};
const logs: TemplateCheckLog[] = [];

function normalizeCategoryName(categoryTitle: string): string {
  return categoryTitle.replace(/^(Category|קטגוריה):/i, '');
}

export function parseParamValidatorError(text: string): ParamValidatorError | null {
  const match = text.match(VALIDATOR_ERROR_REGEX);
  if (!match) {
    return null;
  }

  return {
    templateName: match[1].trim(),
    foreignTitle: match[2].trim(),
    languageCode: match[3].trim(),
  };
}

export function getParamValidatorErrors(parsedContent: string): ParamValidatorError[] {
  return Array.from(new JSDOM(parsedContent).window.document.querySelectorAll(VALIDATOR_ERROR_SELECTOR))
    .map((errorElement: HTMLElement) => parseParamValidatorError(errorElement.textContent))
    .filter((error): error is ParamValidatorError => error != null);
}

function getLanguageApi(languageCode: string): IWikiApi {
  languageApis[languageCode] ??= WikiApi(BaseWikiApi({
    ...defaultConfig,
    assertBot: false,
    baseUrl: `https://${languageCode}.wikipedia.org/w/api.php`,
  }));

  return languageApis[languageCode];
}

function hasSectionTarget(title: string): boolean {
  return title.includes('#');
}

export function readRedirectTarget(content: string): string | null {
  const target = getRedirectTargetFromContent(content, false);
  return target && !hasSectionTarget(target) ? target : null;
}

async function getEasyRedirectTarget(languageApi: IWikiApi, foreignTitle: string): Promise<{
  redirectTarget?: string;
  failedReason?: string;
}> {
  const [{ redirect }, revisions] = await Promise.all([
    languageApi.getRedirecTarget(foreignTitle),
    languageApi.getArticleRevisions(foreignTitle, 1, 'content|ids'),
  ]);

  if (!redirect?.to) {
    return {
      failedReason: 'redirect not found or invalid',
    };
  }
  if (redirect.tosection != null || redirect.tofragment != null) {
    return {
      failedReason: 'redirect has section target',
    };
  }
  // Not relevant since we get only 1 version
  // if (revisions.length > 20) {
  //   return {
  //     failedReason: 'more than 20 revisions',
  //   };
  // }
  const redirectTargetsFromContent = revisions.map((rev) => readRedirectTarget(rev.slots.main['*']));
  const matchContent = redirectTargetsFromContent.every((target) => target === redirect.to);
  return {
    redirectTarget: matchContent ? redirect.to : undefined,
    failedReason: matchContent ? undefined : 'redirect targets changed after the redirect was created',
  };
}

function replaceTemplateParam(
  template: string,
  pageTitle: string,
  templateName: string,
  foreignTitle: string,
  redirectTarget: string,
): string | null {
  const templateData = getTemplateData(template, templateName, pageTitle);
  const arrayData = templateData.arrayData ?? getTemplateArrayData(template, templateName, pageTitle, true);
  const foreignTitleIndex = arrayData.findIndex((value) => value === foreignTitle);

  if (foreignTitleIndex === -1) {
    return null;
  }

  return templateFromTemplateData({
    ...templateData,
    arrayData: arrayData.map((value, index) => (index === foreignTitleIndex ? redirectTarget : value)),
  }, templateName);
}

function addTemplateKeyValueParam(
  template: string,
  pageTitle: string,
  templateName: string,
  key: string,
  value: string,
): string {
  const templateData = getTemplateData(template, templateName, pageTitle);
  return templateFromTemplateData({
    ...templateData,
    keyValueData: {
      ...templateData.keyValueData,
      [key]: value,
    },
  }, templateName);
}

export function fixTitleBracketsAndDots(title: string): string | null {
  let newTitle = title;

  while (newTitle.startsWith('.') || newTitle.startsWith(',') || newTitle.startsWith('}')
    || (newTitle.startsWith('{') && !newTitle.includes('}'))) {
    newTitle = newTitle.slice(1);
  }

  while (newTitle.length > 0) {
    const lastChar = newTitle[newTitle.length - 1];
    const isClosingParenthesis = lastChar === ')';
    const isClosingBracket = lastChar === ']';
    const hasMatchingOpeningChar = (isClosingParenthesis && newTitle.includes('('))
      || (isClosingBracket && newTitle.includes('['));

    if (!isClosingParenthesis && !isClosingBracket) {
      break;
    }
    if (hasMatchingOpeningChar) {
      break;
    }

    newTitle = newTitle.slice(0, -1);
  }

  return newTitle === title ? null : newTitle;
}

export function replaceTemplateForeignTitle(
  content: string,
  pageTitle: string,
  templateName: string,
  foreignTitle: string,
  redirectTarget: string,
): string {
  const replacement = findTemplates(content, templateName, pageTitle)
    .map((template) => ({
      template,
      newTemplate: replaceTemplateParam(template, pageTitle, templateName, foreignTitle, redirectTarget),
    }))
    .find(({ newTemplate }) => newTemplate != null);

  return replacement?.newTemplate
    ? content.replaceAll(replacement.template, replacement.newTemplate)
    : content;
}

export function addTemplateWithoutWikidataItem(
  content: string,
  pageTitle: string,
  templateName: string,
  foreignTitle: string,
): string {
  const replacement = findTemplates(content, templateName, pageTitle)
    .map((template) => ({
      template,
      newTemplate: addTemplateKeyValueParam(template, pageTitle, templateName, 'ללא פריט', 'כן'),
    }))
    .find(({ template }) => getTemplateArrayData(template, templateName, pageTitle, true)
      .some((value) => value === foreignTitle));

  return replacement?.newTemplate
    ? content.replaceAll(replacement.template, replacement.newTemplate)
    : content;
}

function addLog(log: TemplateCheckLog): void {
  logs.push(log);
  console.log(`${log.success ? 'Fixed' : 'Skipped'}: ${log.pageTitle} / ${log.templateName} / ${log.languageCode}:${log.foreignTitle}${log.reason ? ` / ${log.reason}` : ''}`);
}
const latinComparer = new Intl.Collator(undefined, { sensitivity: 'base' });
async function checkMissingRedirect(api: IWikiApi, title: string) {
  const [info] = await api.info([title]);
  if (!info) {
    return {
      isInterwiki: true,
    };
  }
  if (info.invalid != null) {
    const normalizedTitle = decodeURIComponent((fixTitleBracketsAndDots(title) ?? title).replaceAll('_', ' '));
    if (normalizedTitle !== title) {
      const [normalizedTitleInfo] = await api.info([normalizedTitle]);
      if (normalizedTitleInfo?.invalid == null) {
        return {
          isMissing: false,
          newTitle: normalizedTitle,
        };
      }
    }
    return {
      invalid: true,
    };
  }
  if (info.missing == null) {
    return {
      isMissing: false,
    };
  }
  const generator = api.search(title, true);
  const res = await generator.next();
  if (!res.value) {
    return {
      isMissing: true,
    };
  }

  const newTitle = res.value[0]?.title;

  if (res.value.length === 1 && latinComparer.compare(newTitle, title) === 0) {
    return {
      isMissing: false,
      newTitle,
    };
  }

  const normalizedTitle = decodeURIComponent((fixTitleBracketsAndDots(title) ?? title).replaceAll('_', ' '));
  if (normalizedTitle && normalizedTitle !== title) {
    const [normalizedTitleInfo] = await api.info([normalizedTitle]);
    if (normalizedTitleInfo.missing == null) {
      return {
        isMissing: false,
        newTitle: normalizedTitle,
      };
    }
  }
  return {
    isMissing: true,
  };
}

async function handleError(pageTitle: string, content: string, error: ParamValidatorError): Promise<string> {
  const languageApi = getLanguageApi(error.languageCode);
  const redirectTargetResult = await getEasyRedirectTarget(languageApi, error.foreignTitle);
  const {
    isMissing, newTitle, isInterwiki, invalid,
  } = await checkMissingRedirect(
    languageApi,
    error.foreignTitle,
  );
  if (isInterwiki) {
    addLog({
      ...error,
      pageTitle,
      success: false,
      reason: 'probably interwiki',
    });
    return content;
  }
  if (invalid) {
    addLog({
      ...error,
      pageTitle,
      success: false,
      reason: 'invalid title',
    });
    return content;
  }
  const { redirectTarget } = redirectTargetResult;
  const newTarget = newTitle || redirectTarget;

  if (newTarget == null) {
    if (!isMissing && redirectTargetResult.failedReason === 'redirect not found or invalid') {
      const [redirectTargetInfo] = await languageApi.info([error.foreignTitle]);
      if (redirectTargetInfo?.missing == null) {
        const titleToCheck = newTitle || error.foreignTitle;
        const wikidataItem = await languageApi.getWikiDataItem(titleToCheck);

        if (wikidataItem == null) {
          const newContent = addTemplateWithoutWikidataItem(
            content,
            pageTitle,
            error.templateName,
            error.foreignTitle,
          );

          addLog({
            ...error,
            pageTitle,
            success: newContent !== content,
            reason: newContent === content ? 'matching template not found' : undefined,
          });

          return newContent;
        }
      }
    }

    if (isMissing) {
      addLog({
        ...error,
        pageTitle,
        success: false,
        reason: 'target not found',
      });
    } else {
      addLog({
        ...error,
        pageTitle,
        success: false,
        reason: redirectTargetResult.failedReason,
      });
    }

    return content;
  }
  if (WATCHED_TEMPLATES.includes(error.templateName) && redirectTarget) {
    const foreignHasBrackets = error.foreignTitle.includes('(') || error.foreignTitle.includes(')');
    const targetHasBrackets = redirectTarget.includes('(') || redirectTarget.includes(')');
    if (!foreignHasBrackets && targetHasBrackets) {
      addLog({
        ...error,
        pageTitle,
        redirectTarget,
        success: false,
        reason: 'target title has brackets but source does not',
      });
      return content;
    }
  }

  const newContent = replaceTemplateForeignTitle(
    content,
    pageTitle,
    error.templateName,
    error.foreignTitle,
    newTarget,
  );

  addLog({
    ...error,
    pageTitle,
    redirectTarget: newTarget,
    success: newContent !== content,
    reason: newContent === content ? 'matching template not found' : undefined,
  });

  return newContent;
}

function formatLog(log: TemplateCheckLog): string {
  const result = log.success ? 'תוקן' : `דולג: ${log.reason}`;
  const target = log.redirectTarget ? ` ← [[:${log.languageCode}:${log.redirectTarget}]]` : '';
  return `* [[${log.pageTitle}]]: <nowiki>{{${log.templateName}|${log.foreignTitle}}}</nowiki> - [[:${log.languageCode}:${log.foreignTitle}]]${target} - ${result}`;
}

async function writeLogs(api: IWikiApi): Promise<void> {
  const successLogs = logs.filter((log) => log.success);
  const logContent = successLogs.map(formatLog).join('\n');
  const failedLogs = logs.filter((log) => !log.success);
  const failedLogContent = failedLogs.map(formatLog).join('\n');

  try {
    const { revid } = await api.articleContent(LOG_PAGE_TITLE);
    await api.edit(LOG_PAGE_TITLE, EDIT_SUMMARY, `${logContent}\n\n${failedLogContent}`, revid);
  } catch {
    await api.create(LOG_PAGE_TITLE, EDIT_SUMMARY, `${logContent}\n\n${failedLogContent}`);
  }
  logs.splice(0, logs.length);
}

async function handlePage(api: IWikiApi, page: WikiPage): Promise<void> {
  const errors = getParamValidatorErrors(await api.getParsedContent(page.title));
  if (errors.length === 0) {
    addLog({
      pageTitle: page.title,
      templateName: '',
      foreignTitle: '',
      languageCode: '',
      success: false,
      reason: 'no errors found',
    });
    return;
  }
  const content = page.revisions?.[0].slots.main['*'];
  const revid = page.revisions?.[0].revid;
  if (!content || !revid) {
    console.log('No content or revid for', page.title);
    return;
  }

  const newContent = await errors.reduce(
    async (contentPromise, error) => handleError(page.title, await contentPromise, error),
    Promise.resolve(content),
  );

  if (newContent !== content) {
    await api.edit(page.title, EDIT_SUMMARY, newContent, revid);
    console.log('success');
  }
}

export async function handlePageSafely(api: IWikiApi, page: WikiPage): Promise<void> {
  try {
    await handlePage(api, page);
  } catch (err: any) {
    addLog({
      pageTitle: page.title,
      templateName: '',
      foreignTitle: '',
      languageCode: '',
      success: false,
      reason: err.message || err.data || err.toString(),
    });
  }
}

export async function runSinglePage(title: string, api: IWikiApi): Promise<void> {
  const { content, revid } = await api.articleContent(title);

  const page: WikiPage = {
    title,
    pageid: 1,
    ns: 0,
    extlinks: [],
    revisions: [{
      revid,
      slots: {
        main: {
          '*': content,
          contentmodel: 'wikitext',
          contentformat: 'text/x-wiki',
        },
      },
      user: 'Sapper-bot',
      size: content.length,
    }],
  };

  await handlePage(api, page);
}

export default async function foreignWikipediaMissingLinksParsedContent(api: IWikiApi): Promise<void> {
  await asyncGeneratorMapWithSequence(
    50,
    api.categroyPages(normalizeCategoryName(CATEGORY_TITLE)),
    (page) => async () => handlePageSafely(api, page),
  );

  await writeLogs(api);
}
