import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getAttr, getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromOnePage(id: string, title: string) {
  const url = `http://www.one.co.il/Article/${id}.html`;
  try {
    const dom = await JSDOM.fromURL(url);
    const date1 = getMetaValue(dom.window.document, 'property="og:article:published_time"');
    const date2 = getMetaValue(dom.window.document, 'property="og:pubdate"');
    const displayDate = getAttr(dom.window.document, 'time[datetime]', 'datetime');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || (date1 && getLocalDate(date1))
    || (date2 && getLocalDate(date2))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from one page', url, title);
    return '';
  }
}

const TEMPLATE_NAME = 'One';

export default async function oneDates() {
  await templateDates(TEMPLATE_NAME, getDateFromOnePage, [/\[?\[?One\]?\]?/i], 'one');
}
