import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getAttr, getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string, section?: string) {
  const url = `https://www.mako.co.il/${section}/Article-${id}.htm`;
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getMetaValue(dom.window.document, 'property="article:published_time"');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date1 = getAttr(dom.window.document, '[itemprop="datePublished"]', 'content');
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

const TEMPLATE_NAME = 'Mako';
const dataToDate = (data) => {
  const [,, id, section, date] = data;
  return {
    id,
    date,
    section,
  };
};

const filters = [/\[?\[?mako\]?\]?/i, /\[?\[?מאקו\]?\]?/, /\[?\[?חדשות 2\]?\]?/];

export default async function makoDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters, undefined, dataToDate);
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters, 'mako', dataToDate);
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters, 'מאקו', dataToDate);
}
