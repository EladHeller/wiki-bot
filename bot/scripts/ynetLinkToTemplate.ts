import { JSDOM } from 'jsdom';
import { WikiLink } from '../wiki/wikiLinkParser';
import { GeneralLinkTemplateData } from './types';
import { linksToTemplates } from './utils';
import { getAttr, getMetaValue, getSchemaData } from '../scraping';
import { getLocalDate } from '../utilities';
import { basicConverter, PageData } from './linksToTemplates';

// https://www.ynet.co.il/articles/0,7340,L-2918510,00.html
const articleRegex = /https?:\/\/www.ynet\.co\.il\/articles\/\d,\d+,\w-(\d+),\d+\.html/;
// https://www.ynet.co.il/digital/article/r1AIJ48pH
const generalRegex = /https?:\/\/www.ynet\.co\.il\/([^?]+)/;

async function getArticleData(url: string, linkText: string): Promise<PageData | null> {
  try {
    const dom = await JSDOM.fromURL(url);
    const { document } = dom.window;
    const newsSchema = getSchemaData(document, 'NewsArticle');
    const webPageSchema = getSchemaData(document, 'WebPage');

    const title = newsSchema?.headline?.toString()
     || webPageSchema?.name?.toString()
     || getMetaValue(document, 'property="og:title"')
     || getMetaValue(document, 'property="vr:title"')
     || linkText
     || '';
    let author = newsSchema?.author?.name?.toString()
   || getMetaValue(document, 'property="vr:author"')
   || getAttr(document, '.authoranddate a', 'title')
   || '';

    // Flash news
    if (author === 'חדשות') {
      const description = newsSchema?.description?.toString();
      const articleBody = newsSchema?.articleBody?.toString();
      const flashNewAuthor = description?.match(/(\([^)]+\))$/);
      if (description && articleBody && description === articleBody && flashNewAuthor?.[1]) {
        [author] = flashNewAuthor;
      } else {
        author = '';
      }
    }
    if (author === 'ynet') {
      author = '';
    }

    const displayDate = getAttr(document, 'time.DateDisplay', 'datetime');

    const date = getLocalDate(newsSchema?.datePublished?.toString())
      || (displayDate && getLocalDate(displayDate))
      || '';
    const dateModified = getLocalDate(newsSchema?.dateModified?.toString());
    return {
      title,
      author,
      date,
      dateModified,
    };
  } catch (e) {
    console.log('Failed to get article data', url, e);
    return null;
  }
}

async function generalLinkConverter(generalLink: GeneralLinkTemplateData) {
  const url = generalLink['כתובת'];
  const match = url?.match(articleRegex);
  const articleId = match?.[1] ?? url?.match(generalRegex)?.[1] ?? '';
  if (!articleId) {
    console.log('Failed to get article id', url);
    return '';
  }
  const date = generalLink['תאריך'] ?? '';
  const otherData = generalLink['מידע נוסף'] ?? '';
  const otherWords = (otherData || date) ? `|${date}${(date && otherData) ? ', ' : ''}${otherData}` : '';
  return `{{ynet|${generalLink['הכותב'] ?? ''}|${generalLink['כותרת']}|${articleId}${otherWords}}}`;
}

export async function externalLinkConverter(originalText: string, { link, text }: WikiLink, wikiPageTitle: string) {
  const articleId = link.match(articleRegex)?.[1] ?? link.match(generalRegex)?.[1] ?? '';
  if (!articleId) {
    console.log('Failed to get article id', link);
    return null;
  }
  const pageData = await getArticleData(link, text);
  if (!pageData) {
    return null;
  }

  const BasicConverterData = basicConverter(originalText, { link, text }, articleRegex, pageData, wikiPageTitle);
  if (!BasicConverterData) {
    return null;
  }
  const {
    remainText, authorText, date,
  } = BasicConverterData;
  let afterText = remainText;
  if (authorText) {
    const authorRegex = new RegExp(authorText.toString().split(/[,|\s-]/).flatMap((x) => x.trim())
      .join('|'), 'g');
    const authorWithoutDegree = authorText.replace('ד"ר', '')
      .replace('פרופסור', '')
      .replace('פרופ\'', '');
    const withoutDegreee = new RegExp(authorWithoutDegree.toString().split(/[,|\s-]/).map((x) => x.trim())
      .join('|'), 'g');
    afterText = afterText.replace(authorRegex, '').replace(withoutDegreee, '');
  }
  if (afterText.length > 8) {
    console.log({ remainText, originalText });
    return '';
  }

  return `{{ynet|${authorText.trim()}|${text.trim()}|${articleId}${date ? `|${date}` : ''}${link.includes('/premium') ? '|פלוס=כן' : ''}}}`;
}

export default async function ynetLinkToTemplate() {
  await linksToTemplates({
    url: 'www.ynet.co.il',
    generalLinkConverter,
    externalLinkConverter,
    description: 'הסבה לתבנית ynet',
  });
}
