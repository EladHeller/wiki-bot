import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string) {
  const url = `https://www.srugim.co.il/${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    const datePublished = getSchemaData(dom.window.document, 'WebPage')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'סרוגים';

const filters = [
  /\[?\[?סרוגים\]?\]?/,
];

export default async function srugimDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters);
}
