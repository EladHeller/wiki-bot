import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getAttr, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';
import appendDatesToTepmlate from './appendDatesToTepmlate';

const TEMPLATE_NAME = 'Ynet';

async function getDateFromYnetPage(url: string, title: string) {
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getAttr(dom.window.document, 'time.DateDisplay', 'datetime');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = getLocalDate(datePublished)
    || (displayDate && getLocalDate(displayDate))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from ynet page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

export default async function ynetDates() {
  // await appendDatesToTepmlate(TEMPLATE_NAME, getDateFromYnetPage);
  await appendDatesToTepmlate(TEMPLATE_NAME, getDateFromYnetPage, 'ynet');
  // await templateDates(TEMPLATE_NAME, getDateFromYnetPage, [/\[?\[?ynet\]?\]?/]);
  await templateDates(TEMPLATE_NAME, getDateFromYnetPage, [/\[?\[?ynet\]?\]?/], 'ynet');
}
