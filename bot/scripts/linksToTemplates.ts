import 'dotenv/config';
import { writeFile } from 'fs/promises';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import { WikiPage } from '../types';
import { findTemplates, getTemplateArrayData, getTemplateKeyValueData } from '../wiki/newTemplateParser';
import type { CiteNewsTemplate, GeneralLinkTemplateData } from './types';
import { getParagraphContent } from '../wiki/paragraphParser';
import { WikiLink, getExteranlLinks } from '../wiki/wikiLinkParser';

type GeneralLinkToTemplateCallback = (generalLink: GeneralLinkTemplateData) => string;
type ExternalLinkToTemplateCallback = (
  originalText: string, wikiLink: WikiLink
) => Promise<string | null>;
type ConvertionConfig = {
  generalLinkConverter: GeneralLinkToTemplateCallback;
  externalLinkConverter: ExternalLinkToTemplateCallback;
  url: string;
  description?: string;
}

async function linksToTemplatesLogic(
  protocol: string,
  api: ReturnType<typeof NewWikiApi>,
  config: ConvertionConfig,
) {
  const generator = api.externalUrl(config.url, protocol);
  const all: string[] = [];
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
  await asyncGeneratorMapWithSequence<WikiPage>(25, generator, (page) => async () => {
    if (all.length % 1000 === 0) console.log(all.length);
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('Missing content', page.title);
      return;
    }
    all.push(page.title);
    const isContentContains = content.includes(config.url);
    if (!isContentContains) {
      return;
    }

    let newContent = content;

    const externalUrlTemplates = findTemplates(newContent, 'קישור כללי', page.title);
    externalUrlTemplates.forEach((externalUrlTemplate) => {
      const templateData = getTemplateKeyValueData(
        externalUrlTemplate,
      ) as GeneralLinkTemplateData;
      if (templateData['כתובת'].includes(config.url)) {
        const newTemplateText = config.generalLinkConverter(templateData);
        if (newTemplateText) {
          newContent = newContent.replace(externalUrlTemplate, newTemplateText);
        }
      }
    });

    const citeNewsTemplates = findTemplates(newContent, 'Cite news', page.title);
    citeNewsTemplates.forEach((citeNewsTemplate) => {
      const templateData = getTemplateKeyValueData(
        citeNewsTemplate,
      ) as CiteNewsTemplate;
      if (templateData.url?.includes(config.url)) {
        const newTemplateText = config.generalLinkConverter(templateData as any); // WIP
        if (newTemplateText) {
          newContent = newContent.replace(citeNewsTemplate, newTemplateText);
        }
      }
    });

    const externalLinksParagraph = getParagraphContent(newContent, 'קישורים חיצוניים', page.title);
    if (externalLinksParagraph !== null && externalLinksParagraph.includes(config.url)) {
      const rows = externalLinksParagraph?.split('\n');
      await promiseSequence(10, rows.map((externalLinkRow: string) => async () => {
        if (!externalLinkRow.includes(config.url)) {
          return;
        }

        if (!externalLinkRow.match(/\s*\*/)) {
          console.log('extrnal links: possible problem: no *', page.title, externalLinkRow);
          return;
        }

        const externalLinks = getExteranlLinks(externalLinkRow);
        if (externalLinks.length !== 1) {
          console.log('extrnal links: possible problem: zero or many', page.title, externalLinks);
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
    references.forEach(async (reference) => {
      if (!reference.includes(config.url)) {
        return;
      }
      const [referenceContent] = getTemplateArrayData(reference, 'הערה', page.title, true);
      if (!referenceContent) {
        return;
      }
      const externalLinks = getExteranlLinks(referenceContent);
      if (externalLinks.length !== 1) {
        console.log('extrnal links: possible problem: zero or many', page.title, externalLinks);
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
    });
    // if (newContent !== content) {
    //   await api.updateArticle(page.title, config.description || 'הסבה לתבנית', newContent);
    //   console.log('success update', page.title);
    // }
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
  await linksToTemplatesLogic('https', api, config);
  await linksToTemplatesLogic('http', api, config);
}
