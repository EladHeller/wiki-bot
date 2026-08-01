/* eslint-disable max-len */
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import WikiApi from '../../../wiki/WikiApi';
import linksToTemplates, { basicConverter, PageData } from '../../linksToTemplates';
import { WikiLink } from '../../../wiki/wikiLinkParser';
import { CiteNewsTemplate, GeneralLinkTemplateData } from '../../types';
import { getContent } from '../../../scraping';

const oldLink = 'benyehuda.org/read';
// https://benyehuda.org/read/41629
// https://benyehuda.org/read/14035#ch4530
const linkRegex = /https?:\/\/benyehuda\.org\/read\/(?<id>\d+(?:#ch\d+)?)/i;

async function getDataFromPage(link: string, articleTitle: string): Promise<PageData & { id: string } | null> {
  const match = link.match(linkRegex);
  const { id } = match?.groups ?? {};
  if (!id) {
    console.log('Failed to get article id', link, articleTitle, { id });
    return null;
  }
  const url = `https://benyehuda.org/read/${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    if (dom.window.document.title.includes('404 not found')) {
      console.log('404', url, articleTitle);
      return null;
    }

    const author = getContent(dom.window.document, '.work-title a')?.trim() ?? undefined;
    const title = getContent(dom.window.document, '.work-and-author-names-desktop > .work-name-top')?.trim() ?? undefined;

    return {
      author,
      title,
      id,
    };
  } catch (e) {
    console.log('Failed to get data from page', url, articleTitle, e);
    return null;
  }
}

async function generalLinkConverter(generalLink: CiteNewsTemplate | GeneralLinkTemplateData) {
  const generalLinkData: GeneralLinkTemplateData = generalLink as GeneralLinkTemplateData;
  const citeNews: CiteNewsTemplate = generalLink as CiteNewsTemplate;

  const url = generalLinkData?.['כתובת'] || citeNews?.url || '';
  const match = url.match(linkRegex);
  const id = match?.groups?.id;
  if (!match || !id) {
    console.log('Failed to get article id', url);
    return '';
  }
  const otherData = 'מידע נוסף' in generalLink ? generalLink['מידע נוסף'] ?? '' : '';
  const otherWords = otherData ? `|מידע נוסף=${otherData}` : '';

  const title = generalLinkData?.['כותרת'] || citeNews?.title || '';
  const authors = generalLinkData?.['הכותב'] || citeNews?.author || '';

  return `{{פרויקט בן-יהודה|זיהוי=${id}|שם=${authors}|שם היצירה=${title}${otherWords}}}`;
}

const remains: string[][] = [];

async function externalLinkConverter(originalText: string, { link, text }: WikiLink, wikiPageTitle: string) {
  const pageData = await getDataFromPage(link, originalText);
  const converterData = basicConverter(originalText, { link, text }, linkRegex, pageData, wikiPageTitle);
  if (!converterData || !pageData) {
    return null;
  }
  const {
    remainText,
  } = converterData;
  if (remainText) {
    remains.push([remainText, originalText]);
    return null;
  }

  return `{{פרויקט בן-יהודה|זיהוי=${pageData.id}|שם=${pageData.author}|שם היצירה=${pageData.title}}}`;
}

export default async function benyehudaTemplate() {
  await linksToTemplates({
    url: oldLink,
    description: 'המרת קישור לתבנית פרויקט-בן יהודה',
    externalLinkConverter,
    generalLinkConverter,
  });

  await fs.writeFile('remains.log', remains.join('\n'));
}
