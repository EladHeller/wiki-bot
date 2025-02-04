import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getAttr, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string) {
  let url = `https://www.israelhayom.co.il/article/${id}`;
  if (!id.match(/^[0-9]{2,20}$/)) {
    url = `https://www.israelhayom.co.il/${id}`;
  }
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getAttr(dom.window.document, 'time[datetime]', 'datetime');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from israel hayom page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'ישראל היום';

export default async function israelHayomDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, [/\[?\[?ישראל היום\]?\]?/i]);
}
