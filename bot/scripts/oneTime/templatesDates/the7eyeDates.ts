import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string) {
  const url = `http://www.the7eye.org.il/${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getMetaValue(dom.window.document, 'property="article:published_time"');
    const date1 = getMetaValue(dom.window.document, 'itemprop="dateCreated"');
    const datePublished = getSchemaData(dom.window.document, 'WebPage')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || (date1 && getLocalDate(date1))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'העין השביעית';

export default async function the7eyeDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, [/\[?\[?העין השביעית\]?\]?/]);
}
