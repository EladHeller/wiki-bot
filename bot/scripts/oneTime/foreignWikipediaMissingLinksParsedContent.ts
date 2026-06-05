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
const LOG_PAGE_TITLE = 'user:sapper-bot/קישורי שפה - הפניות';
const EDIT_SUMMARY = 'תיקון קישורי שפה: החלפת הפניה בערך היעד';
const VALIDATOR_ERROR_SELECTOR = '.paramvalidator-error';
const VALIDATOR_ERROR_REGEX = /שימוש בתבנית\s+(.+?)\s+עבור\s+"(.+?)"\s+בשפה\s+([a-z-]+)\s+אך ערך זה לא קיים בשפה זו/i;

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
    .map((errorElement) => parseParamValidatorError(errorElement.textContent ?? ''))
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
  const target = getRedirectTargetFromContent(content);
  return target && !hasSectionTarget(target) ? target : null;
}

async function getEasyRedirectTarget(languageApi: IWikiApi, foreignTitle: string): Promise<string | null> {
  const [{ redirect }, revisions] = await Promise.all([
    languageApi.getRedirecTarget(foreignTitle),
    languageApi.getArticleRevisions(foreignTitle, 2, 'content|ids'),
  ]);

  if (!redirect?.to || redirect.tofragment != null || redirect.tosection != null || revisions.length !== 1) {
    return null;
  }

  const redirectTargetFromContent = readRedirectTarget(revisions[0]?.slots?.main?.['*'] ?? '');
  return redirectTargetFromContent === redirect.to ? redirect.to : null;
}

function replaceFirst(content: string, from: string, to: string): string {
  const index = content.indexOf(from);
  if (index === -1) {
    return content;
  }

  return `${content.substring(0, index)}${to}${content.substring(index + from.length)}`;
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
    ? replaceFirst(content, replacement.template, replacement.newTemplate)
    : content;
}

function addLog(log: TemplateCheckLog): void {
  logs.push(log);
  console.log(`${log.success ? 'Fixed' : 'Skipped'}: ${log.pageTitle} / ${log.templateName} / ${log.languageCode}:${log.foreignTitle}${log.reason ? ` / ${log.reason}` : ''}`);
}

async function handleError(pageTitle: string, content: string, error: ParamValidatorError): Promise<string> {
  const redirectTarget = await getEasyRedirectTarget(getLanguageApi(error.languageCode), error.foreignTitle);

  if (!redirectTarget) {
    addLog({
      ...error,
      pageTitle,
      success: false,
      reason: 'not an easy redirect',
    });
    return content;
  }

  const newContent = replaceTemplateForeignTitle(
    content,
    pageTitle,
    error.templateName,
    error.foreignTitle,
    redirectTarget,
  );

  addLog({
    ...error,
    pageTitle,
    redirectTarget,
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
  const logContent = logs.map(formatLog).join('\n');

  try {
    const { revid } = await api.articleContent(LOG_PAGE_TITLE);
    await api.edit(LOG_PAGE_TITLE, EDIT_SUMMARY, logContent, revid);
  } catch {
    await api.create(LOG_PAGE_TITLE, EDIT_SUMMARY, logContent);
  }
}

async function handlePage(api: IWikiApi, page: WikiPage): Promise<void> {
  const errors = getParamValidatorErrors(await api.getParsedContent(page.title));
  if (errors.length === 0) {
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
  }
}

async function handlePageSafely(api: IWikiApi, page: WikiPage): Promise<void> {
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

export default async function foreignWikipediaMissingLinksParsedContent(): Promise<void> {
  const api = WikiApi();
  await api.login();

  await asyncGeneratorMapWithSequence(
    1,
    api.categroyPages(normalizeCategoryName(CATEGORY_TITLE)),
    (page) => async () => handlePageSafely(api, page),
  );

  await writeLogs(api);
}
