import { JSDOM } from 'jsdom';
import { WikiLink } from '../wiki/wikiLinkParser';
import { GeneralLinkTemplateData } from './types';
import { linksToTemplates } from './utils';
import { getAttr, getMetaValue, getSchemaData } from '../scraping';
import { getLocalDate } from '../utilities';

// https://www.ynet.co.il/articles/0,7340,L-2918510,00.html
const articleRegex = /https?:\/\/www.ynet\.co\.il\/articles\/\d,\d+,\w-(\d+),\d+\.html/;
// https://www.ynet.co.il/digital/article/r1AIJ48pH
const generalRegex = /https?:\/\/www.ynet\.co\.il\/([^?]+)/;

function generalLinkConverter(generalLink: GeneralLinkTemplateData) {
  const url = generalLink['כתובת'];
  const match = url.match(articleRegex);
  const articleId = match?.[1] ?? url.match(generalRegex)?.[1] ?? '';
  if (!articleId) {
    console.log('Failed to get article id', url);
    return '';
  }
  const date = generalLink['תאריך'] ?? '';
  const otherData = generalLink['מידע נוסף'] ?? '';
  const otherWords = (otherData || date) ? `|${date}${(date && otherData) ? ', ' : ''}${otherData}` : '';
  return `{{ynet|${generalLink['הכותב'] ?? ''}|${generalLink['כותרת']}|${articleId}${otherWords}}}`;
}

export async function externalLinkConverter(originalText: string, { link, text }: WikiLink) {
  const articleId = link.match(articleRegex)?.[1] ?? link.match(generalRegex)?.[1] ?? '';
  if (!articleId) {
    console.log('Failed to get article id', link);
    return null;
  }
  const dom = await fetch(link.replace('/premium', '')).then((res) => res.text()).then((res) => new JSDOM(res));
  const { document } = dom.window;
  const newsSchema = getSchemaData(document, 'NewsArticle');
  const webPageSchema = getSchemaData(document, 'WebPage');

  const title = newsSchema?.headline?.toString()
     || webPageSchema?.name?.toString()
     || getMetaValue(document, 'property="og:title"')
     || getMetaValue(document, 'property="vr:title"')
     || text
     || '';
  const author = newsSchema?.author?.name?.toString()
   || getMetaValue(document, 'property="vr:author"')
   || getAttr(document, '.authoranddate a', 'title')
   || '';

  const displayDate = getAttr(document, 'time.DateDisplay', 'datetime');

  const date = getLocalDate(newsSchema?.datePublished?.toString())
    || (displayDate && getLocalDate(displayDate))
    || '';
  const dateModified = getLocalDate(newsSchema?.dateModified?.toString());
  let remainText = originalText.replace(text, '')
    .replace(link, '')
    .replace(title.trim(), '')
    .replace(date.trim(), '')
    .replace(dateModified, '')
    .replace(author.trim(), '')
    .replace(/(?:\[\[)?ynet(?:\]\])?/g, '')
    .replace(/(?:\[\[)?ידיעות(?:\]\])?/g, '')
    .replace(/ב?אתר/g, '')
    .replace(/ב-/g, '')
    .replace(/ ב /g, '')
    .replace(/בתאריך/g, '')
    .replace(/ביקורת/g, '')
    .replace(/מוסף ל?שבת/g, '')
    .replace(/פנאי פלוס/g, '')
    .replace(/ערוץ הבריאות/g, '')
    .replace(/\d{1,2}[\s,-]{1,3}[א-ת]{4,8}[\s,-]{1,3}\d{4}/g, '')
    .replace(/טור דעה(?: על)?/g, '')
    .replace(/{{כ}}/g, '')
    .replace(/{{סרטונים}}/g, '')
    .replace(/\d{1,2}(?:[.-/])\d{1,2}(?:[.-/])\d{2,4}/g, '');
  if (author) {
    const authorRegex = new RegExp(author.toString().split(/[,|\s-]/).flatMap((x) => x.trim())
      .join('|'), 'g');
    const authorWithoutDegree = author.replace('ד"ר', '')
      .replace('פרופסור', '')
      .replace('פרופ\'', '');
    const withoutDegreee = new RegExp(authorWithoutDegree.toString().split(/[,|\s-]/).map((x) => x.trim())
      .join('|'), 'g');
    remainText = remainText.replace(authorRegex, '').replace(withoutDegreee, '');
  }
  remainText = remainText.replace(/[ֿ[\]|().,\-:"\sֿֿֿ*']/g, '');
  if (remainText.length > 10) {
    console.log({ remainText, originalText });
    return '';
  }

  return `* {{ynet|${author.trim()}|${title.trim()}|${articleId}${date ? `|${date}` : ''}${link.includes('/premium') ? '|פלוס=כן' : ''}}}`;
}

export default async function ynetLinkToTemplate() {
  await linksToTemplates({
    url: 'www.ynet.co.il',
    generalLinkConverter,
    externalLinkConverter,
    description: 'הסבה ל-{{תב|ynet}}',
  });
}
