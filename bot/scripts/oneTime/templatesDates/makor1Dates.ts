import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string) {
  const url = `https://www.makorrishon.co.il/${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getMetaValue(dom.window.document, 'property="article:published_time"');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from page', url, title);
    return '';
  }
}

const TEMPLATE_NAME = 'מקור ראשון';

export default async function makor1Dates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, [/\[?\[?מקור ראשון\]?\]?/]);
}
