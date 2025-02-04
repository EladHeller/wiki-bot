import { JSDOM } from 'jsdom';
import {
  getLocalDate,
} from '../../../utilities';
import { getAttr, getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromWallaPage(id: string, title: string, section?: string) {
  let url = `http://news.walla.co.il/?w=//${id}`;
  if (section) {
    url = `https://${section}.walla.co.il/item/${id}`;
  }
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getMetaValue(dom.window.document, 'property="article:published_time"');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const dateTime = getAttr(dom.window.document, 'time.data', 'datetime');
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || (dateTime && getLocalDate(dateTime))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from walla page', url, title, section, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'וואלה!';

export default async function wallaDates() {
  // await templateDates(
  //  TEMPLATE_NAME, getDateFromWallaPage, [/\[?\[?וואלה!?\]?\]?/, /\[?\[?הארץ\]?\]?/], 'וואלה');
  await templateDates(TEMPLATE_NAME, getDateFromWallaPage, [/\[?\[?וואלה!?\]?\]?/, /\[?\[?הארץ\]?\]?/], TEMPLATE_NAME);
}
