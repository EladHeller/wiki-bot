import 'dotenv/config';
import { writeFile } from 'fs/promises';
import findHebrewFullNames from 'find-hebrew-names';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../utilities';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import { WikiPage } from '../types';
import { findTemplates, getTemplateArrayData, getTemplateKeyValueData } from '../wiki/newTemplateParser';
import type { CiteNewsTemplate, GeneralLinkTemplateData } from './types';
import { getParagraphContent } from '../wiki/paragraphParser';
import { WikiLink, getExternalLinks } from '../wiki/wikiLinkParser';
import israeliAuthors from '../data/israeli-authors.json';
import formalizedDateFormat from '../utilities/formalizedDateFormat';

const citeNewsAllowedKeys = ['title', 'url', 'date', 'last', 'first', 'author', 'access-date', 'newspaper', 'access-date'];

const dateRegex = /\d{1,2}(?:[.-/])\d{1,2}(?:[.-/])(?:\[\[)?\d{2,4}(?:\]\])?/;
const otherDateRegex = /(?:(?:\[\[)?\d{1,2}[\s,-]{1,3})?[א-ת]{3,8}(?:\]\])?[\s,-]{1,3}(?:\[\[)?\d{4}(?:\]\])?/;

type GeneralLinkToTemplateCallback = (generalLink: GeneralLinkTemplateData | CiteNewsTemplate) => Promise<string|null>;

type ExternalLinkToTemplateCallback = (originalText: string, wikiLink: WikiLink, wikiPageTitle: string) =>
   Promise<string | null>;
type ConvertionConfig = {
  generalLinkConverter: GeneralLinkToTemplateCallback;
  externalLinkConverter: ExternalLinkToTemplateCallback;
  url: string;
  description?: string;
}

type BasicConverterData = {
  link: string;
  text: string;
  remainText: string;
  authorText: string;
  date: string;
  match: RegExpMatchArray;
}

type TemplateFixData = {
  title: string;
  originalText: string;
  newTemplateText: string;
}
export type PageData = {
  date?: string;
  author?: string;
  title?: string;
  dateModified?: string;
}

export function basicConverter(
  originalText: string,
  { link, text }: WikiLink,
  linkRegex: RegExp,
  pageData: PageData | null,
  wikiPageTitle: string,
): BasicConverterData | null {
  const match = link.match(linkRegex);
  if (!match) {
    return null;
  }
  let remainText = originalText;
  const date = originalText.match(dateRegex)?.[0] ?? originalText.match(otherDateRegex)?.[0] ?? pageData?.date ?? '';

  remainText = remainText
    .replace(link, '')
    .replace(text, '')
    .replace(date, '')
    .replace(pageData?.title ?? '', '')
    .replace(pageData?.date ?? '', '')
    .replace(pageData?.dateModified ?? '', '')
    .replace('{{כותרת קישור נוצרה על ידי בוט}}', '')
    .replace(/(?:\[\[)?nrg(?:\]\])?/gi, '')
    .replace(/(?:\[\[)?מעריב(?:\]\])?/g, '')
    .replace(/[מב]?אתר/g, '')
    .replace(/ב-/g, '')
    .replace(/ה-/g, '')
    .replace(/(?:\[\[)?ynet(?:\]\])?/g, '')
    .replace(/(?:\[\[)?ידיעות(?: אחרונות)?(?:\]\])?/g, '')
    .replace(/זמן תל אביב/g, '')
    .replace(/ב-/g, '')
    .replace(/ ב /g, '')
    .replace(/מתוך/g, '')
    .replace(/ראיון/g, '')
    .replace(/ספורט/g, '')
    .replace(/{{קישור שבור}}/g, '')
    .replace(/ידיעות אחרונות/g, '')
    .replace('nrg.co.il', '')
    .replace(/הארץ/g, '')
    .replace(/זמן ירושלים/g, '')
    .replace(/פורסם/g, '')
    .replace(/סופשבוע/g, '')
    .replace(/סגנון/g, '')
    .replace(/מוסף ל?שבת/g, '')
    .replace(/ערוץ הבריאות/g, '')
    .replace(/טור דעה(?: על)?/g, '')
    .replace(/פנאי פלוס/g, '')
    .replace(/ביקורת/g, '')
    .replace(/נשים/g, '')
    .replace(/גליון/g, '')
    .replace(/מקור ראשון/g, '')
    .replace(/חדשות/g, '')
    .replace(/המקוון/g, '')
    .replace(/ניו אייג'/g, '')
    .replace(/בתאריך/g, '')
    .replace(/כתבה/g, '')
    .replace(/מאת/g, '')
    .replace(/כתבת/g, '')
    .replace(/ארכיון/g, '')
    .replace(/עיתונאי/g, '')
    .replace(/שליפות/g, '')
    .replace(/יהדות/g, '')
    .replace(/{{כ}}/g, '')
    .replace(/\d{1,2}[\s,-]{1,3}[א-ת]{4,8}[\s,-]{1,3}\d{4}/g, '')
    .replace(/\d{1,2}(?:[.-/])\d{1,2}(?:[.-/])\d{2,4}/g, '')
    .replace(/ד"ר/g, '')
    .replace(/{{סרטונים}}/g, '');

  let authors: string[] = [];
  if (pageData?.author) {
    authors.push(pageData.author);
  }
  for (const author of israeliAuthors) {
    if (remainText.includes(author)) {
      authors.push(author);
    }
  }
  const hebrewNames = findHebrewFullNames(remainText);
  for (const name of hebrewNames) {
    if (remainText.includes(name)) {
      authors.push(name);
    }
  }
  authors = Array.from(new Set(authors));
  authors.forEach((author) => {
    remainText = remainText.replaceAll(author, '');
  });
  const lastAuthor = authors.pop();
  let authorText = '';
  if (pageData?.author) {
    authorText = pageData.author;
  } else if (!authors.length) {
    authorText = lastAuthor || '';
  } else {
    authorText = `${authors.join(', ')} ו${lastAuthor}`;
  }

  remainText = remainText.replace(/\s+/g, '')
    .replace(/[[\],*()|:.'"–ו-]/g, '');

  return {
    remainText,
    authorText,
    date: formalizedDateFormat(date, wikiPageTitle) || date || '',
    link,
    text,
    match,
  };
}

const all: string[] = [];
const updated: string[] = [];
const notFoundLinks: string[] = [];
const externalLinksFixes: Array<TemplateFixData> = [];
const referenceFixes: Array<TemplateFixData> = [];

export async function pageConvertLinksToTemplate(page: WikiPage, api: IWikiApi, config: ConvertionConfig) {
  if (all.length % 100 === 0) console.log(all.length);
  let isLinkFound = false;
  const content = page.revisions?.[0].slots.main['*'];
  if (!content) {
    console.log('Missing content', page.title);
    notFoundLinks.push(page.title);
    return;
  }
  const revId = page.revisions?.[0].revid;
  if (!revId) {
    console.log('Missing revid', page.title);
    notFoundLinks.push(page.title);
    return;
  }

  all.push(page.title);
  const isContentContains = content.includes(config.url);
  if (!isContentContains) {
    // console.log('Not contains', page.title);
    // notFoundLinks.push(page.title);
    return;
  }

  let newContent = content;

  const externalUrlTemplates = findTemplates(newContent, 'קישור כללי', page.title);
  await Promise.all(externalUrlTemplates.map(async (externalUrlTemplate) => {
    const templateData = getTemplateKeyValueData(
      externalUrlTemplate,
    ) as GeneralLinkTemplateData;
    if (templateData['כתובת'].includes(config.url)) {
      isLinkFound = true;
      const newTemplateText = await config.generalLinkConverter(templateData);
      if (newTemplateText) {
        newContent = newContent.replace(externalUrlTemplate, newTemplateText);
      }
    }
  }));

  const citeNewsTemplates = findTemplates(newContent, 'Cite news', page.title);
  await Promise.all(citeNewsTemplates.map(async (citeNewsTemplate) => {
    const templateData = getTemplateKeyValueData(
      citeNewsTemplate,
    ) as CiteNewsTemplate;

    if (templateData.url?.includes(config.url)) {
      isLinkFound = true;
      const keys = Object.keys(templateData);
      if (keys.some((key) => !citeNewsAllowedKeys.includes(key))) {
        console.log('Cite news: unknown key', page.title, keys);
        return;
      }
      const newTemplateText = await config.generalLinkConverter(templateData as CiteNewsTemplate);
      if (newTemplateText) {
        newContent = newContent.replace(citeNewsTemplate, newTemplateText);
      }
    }
  }));

  const externalLinksParagraph = getParagraphContent(newContent, 'קישורים חיצוניים', page.title);
  if (externalLinksParagraph !== null && externalLinksParagraph.includes(config.url)) {
    const rows = externalLinksParagraph?.split('\n');
    await promiseSequence(10, rows.map((externalLinkRow: string) => async () => {
      if (!externalLinkRow.includes(config.url)) {
        return;
      }
      isLinkFound = true;

      if (!externalLinkRow.match(/\s*\*/)) {
        // console.log('extrnal links: possible problem: no *', page.title, externalLinkRow);
        return;
      }

      const externalLinks = getExternalLinks(externalLinkRow);
      if (externalLinks.length !== 1) {
        // console.log('extrnal links: possible problem: zero or many', page.title, externalLinks);
        return;
      }
      const newRow = await config.externalLinkConverter(externalLinkRow, externalLinks[0], page.title);
      if (newRow == null) {
        return;
      }
      externalLinksFixes.push({
        title: page.title,
        originalText: externalLinkRow,
        newTemplateText: newRow,
      });
      if (newRow) {
        newContent = newContent.replace(externalLinkRow, `* ${newRow}`);
      }
    }));
  }

  const references = findTemplates(newContent, 'הערה', page.title);
  await Promise.all(references.map(async (reference) => {
    if (!reference.includes(config.url)) {
      return;
    }
    isLinkFound = true;
    const [referenceContent] = getTemplateArrayData(reference, 'הערה', page.title, true);
    if (!referenceContent) {
      return;
    }
    const externalLinks = getExternalLinks(referenceContent);
    if (externalLinks.length !== 1) {
      // console.log('extrnal links: possible problem: zero or many', page.title, externalLinks);
      return;
    }
    const newReferenceContent = await config.externalLinkConverter(
      referenceContent,
      externalLinks[0],
      page.title,
    );
    if (newReferenceContent == null) {
      return;
    }
    referenceFixes.push({
      title: page.title,
      originalText: referenceContent,
      newTemplateText: newReferenceContent,
    });
    if (newReferenceContent) {
      newContent.replace(referenceContent, newReferenceContent);
    }
  }));

  const refReferences = newContent.matchAll(/<ref>(?<content>[^<]*)<\/ref>/g);
  await Promise.all(Array.from(refReferences).map(async (reference) => {
    const referenceContent = reference.groups?.content;
    if (!referenceContent) {
      return;
    }
    if (!referenceContent.includes(config.url)) {
      return;
    }
    isLinkFound = true;
    const externalLinks = getExternalLinks(referenceContent);
    if (externalLinks.length !== 1) {
      // console.log('extrnal links: possible problem: zero or many', page.title, externalLinks);
      return;
    }
    const newReferenceContent = await config.externalLinkConverter(
      referenceContent,
      externalLinks[0],
      page.title,
    );
    if (newReferenceContent == null) {
      return;
    }
    referenceFixes.push({
      title: page.title,
      originalText: referenceContent,
      newTemplateText: newReferenceContent,
    });
    if (newReferenceContent) {
      newContent.replace(referenceContent, newReferenceContent);
    }
  }));

  if (!isLinkFound) {
    console.log('Not found', page.title);
    notFoundLinks.push(page.title);
    return;
  }

  if (newContent !== content) {
    await api.edit(page.title, config.description || 'הסבה לתבנית', newContent, revId);
    updated.push(page.title);
    console.log('success update', page.title);
  }
}

async function linksToTemplatesLogic(
  protocol: string,
  api: IWikiApi,
  config: ConvertionConfig,
) {
  await asyncGeneratorMapWithSequence<WikiPage>(1, api.externalUrl(config.url, protocol), (page) => async () => {
    await pageConvertLinksToTemplate(page, api, config);
  });
  const log = externalLinksFixes.map((x) => `*[[${x.title}]]\n*${x.originalText}\n*${x.newTemplateText || '* ----'}`).join('\n');
  await writeFile(`${protocol}ExternalLinks.log`, JSON.stringify(log, null, 2));
  const referenceLog = referenceFixes.map((x) => `*[[${x.title}]]\n*${x.originalText}\n*${x.newTemplateText || '* ----'}`).join('\n');
  await writeFile(`${protocol}References.log`, JSON.stringify(referenceLog, null, 2));
}

export default async function linksToTemplates(
  config: ConvertionConfig,
) {
  const api = NewWikiApi();
  await api.login();
  all.splice(0, all.length);
  updated.splice(0, updated.length);
  await linksToTemplatesLogic('https', api, config);
  await linksToTemplatesLogic('http', api, config);
  console.log('Pages:', all.length);
  console.log('Updated:', updated.length);
}
