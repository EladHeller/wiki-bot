import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import templateDates from './templateDates';
import { getAttr, getMetaValue, getSchemaData } from '../../../scraping';

const TEMPLATE_NAME = 'הארץ';

async function getDateFromPage(id: string, title: string) {
  const url = `https://www.haaretz.co.il/${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    if (dom.window.location.href === 'https://www.haaretz.co.il/') {
      console.log('Page not found', url, title);
      return '';
    }
    const date1 = getMetaValue(dom.window.document, 'property="article:published"');
    const date2 = getMetaValue(dom.window.document, 'property="ob:pubDate"');
    const date3 = getMetaValue(dom.window.document, 'property="publishDate"');
    const displayDate = getAttr(dom.window.document, 'time[datetime]', 'datetime');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || (date1 && getLocalDate(date1))
    || (date2 && getLocalDate(date2))
    || (date3 && getLocalDate(date3))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from page', url, title);
    return '';
  }
}

export default async function haaretzDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, [/\[?\[?הארץ\]?\]?/]);
}
