import 'dotenv/config';
import { writeFile } from 'fs/promises';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../utilities';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import { WikiPage } from '../types';
import { findTemplates, getTemplateArrayData, getTemplateKeyValueData } from '../wiki/newTemplateParser';
import type { CiteNewsTemplate, GeneralLinkTemplateData } from './types';
import { getParagraphContent } from '../wiki/paragraphParser';
import { WikiLink, getExternalLinks } from '../wiki/wikiLinkParser';

type GeneralLinkToTemplateCallback = (generalLink: GeneralLinkTemplateData | CiteNewsTemplate) => Promise<string|null>;
type ExternalLinkToTemplateCallback = (
  originalText: string, wikiLink: WikiLink
) => Promise<string | null>;
type ConvertionConfig = {
  generalLinkConverter: GeneralLinkToTemplateCallback;
  externalLinkConverter: ExternalLinkToTemplateCallback;
  url: string;
  description?: string;
}

const all: string[] = [];
const updated: string[] = [];
async function linksToTemplatesLogic(
  protocol: string,
  api: IWikiApi,
  config: ConvertionConfig,
) {
  const generator = api.externalUrl(config.url, protocol);
  const externalLinksFixes: Array<{
    title: string;
    originalText: string;
    newTemplateText: string;
  }> = [];
  const referenceFixes: Array<{
    title: string;
    originalText: string;
    newTemplateText: string;
  }> = [];
  await asyncGeneratorMapWithSequence<WikiPage>(5, generator, (page) => async () => {
    if (all.length % 1000 === 0) console.log(all.length);
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('Missing content', page.title);
      return;
    }
    const revId = page.revisions?.[0].revid;
    if (!revId) {
      console.log('Missing revid', page.title);
      return;
    }

    all.push(page.title);
    const isContentContains = content.includes(config.url);
    if (!isContentContains) {
      return;
    }

    let newContent = content;

    const externalUrlTemplates = findTemplates(newContent, 'קישור כללי', page.title);
    await Promise.all(externalUrlTemplates.map(async (externalUrlTemplate) => {
      const templateData = getTemplateKeyValueData(
        externalUrlTemplate,
      ) as GeneralLinkTemplateData;
      if (templateData['כתובת'].includes(config.url)) {
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

        if (!externalLinkRow.match(/\s*\*/)) {
          // console.log('extrnal links: possible problem: no *', page.title, externalLinkRow);
          return;
        }

        const externalLinks = getExternalLinks(externalLinkRow);
        if (externalLinks.length !== 1) {
          // console.log('extrnal links: possible problem: zero or many', page.title, externalLinks);
          return;
        }
        const newRow = await config.externalLinkConverter(externalLinkRow, externalLinks[0]);
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
    if (newContent !== content) {
      await api.edit(page.title, config.description || 'הסבה לתבנית', newContent, revId);
      updated.push(page.title);
      console.log('success update', page.title);
    }
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
