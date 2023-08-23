import 'dotenv/config';
import { writeFile } from 'fs/promises';
import { asyncGeneratorMapWithSequence } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import { WikiPage } from '../types';
import { findTemplates, getTemplateKeyValueData } from '../wiki/newTemplateParser';
import type { GeneralLinkTemplateData } from './types';
import { getParagraphContent } from '../wiki/paragraphParser';

type GeneralLinkToTemplateCallback = (generalLink: GeneralLinkTemplateData) => string;
type ConvertionConfig = {
  generalLinkConverter: GeneralLinkToTemplateCallback
}

async function linksToTemplatesLogic(
  url: string,
  protocol: string,
  api: ReturnType<typeof NewWikiApi>,
  config: ConvertionConfig,
) {
  const generator = api.externalUrl(url, protocol);
  const all: string[] = [];
  const missingLink: string[] = [];
  const generalLinks = new Set<string>();
  await asyncGeneratorMapWithSequence<WikiPage>(25, generator, (page) => async () => {
    if (all.length % 1000 === 0) console.log(all.length);
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('Missing content', page.title);
      return;
    }
    all.push(page.title);
    const isContentContains = content.includes(url);
    if (!isContentContains) {
      missingLink.push(page.title);
      return;
    }

    let newContent = content;

    const externalUrlTemplates = findTemplates(content, 'קישור כללי', page.title);
    externalUrlTemplates.forEach((externalUrlTemplate) => {
      const templateData = getTemplateKeyValueData(
        externalUrlTemplate,
      ) as GeneralLinkTemplateData;
      if (templateData['כתובת'].includes(url)) {
        generalLinks.add(page.title);
        const newTemplateText = config.generalLinkConverter(templateData);
        if (newTemplateText) {
          newContent = newContent.replace(externalUrlTemplate, newTemplateText);
        }
      }
    });

    const externalLinksParagraph = getParagraphContent(content, 'קישורים חיצוניים');
    externalLinksParagraph?.split('\n').forEach((externalLink) => {
      if (!externalLink.includes(url)) return;

      if (!externalLink.match(/^\s*\*\s*\[https?:\/\/www\.ynet/)) {
        console.log('possible externalLink', externalLink);
        return;
      }
      console.log('externalLink', externalLink);
    });

    if (newContent !== content) {
      await api.updateArticle(page.title, 'הסבה לתבנית', newContent);
      console.log('success update', page.title);
    }
  });

  console.log(all.length, generalLinks.size);
  await writeFile(`${protocol}linksToTemplates.json`, JSON.stringify(all, null, 2));
  await writeFile(`${protocol}linksToTemplatesGeneralLink.json`, JSON.stringify(Array.from(generalLinks), null, 2));
  await writeFile(`${protocol}linksToTemplatesMissingLinks.json`, JSON.stringify(missingLink, null, 2));
}

export default async function linksToTemplates(
  url: string,
  config: ConvertionConfig,
) {
  const api = NewWikiApi();
  await api.login();
  await linksToTemplatesLogic(url, 'https', api, config);
  await linksToTemplatesLogic(url, 'http', api, config);
}
