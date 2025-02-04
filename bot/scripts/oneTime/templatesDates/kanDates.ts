import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getAttr, getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

const sectionDict = {
  podcast: 'Podcast/item.aspx?pid=',
  program: 'Program/?catId=',
  radio: 'Radio/item.aspx?pid=',
  live: 'live/radio.aspx?stationId=',
  item: 'Item/?itemId=',
};

async function getDateFromPage(id: string, title: string, section?: string) {
  const url = `https://www.kan.org.il/${sectionDict[section?.toLowerCase() || ''] || ''}${id}`;

  try {
    const dom = await JSDOM.fromURL(url);
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const displayDate = getAttr(dom.window.document, '.date-local', 'data-date-utc');
    const publishTime = getMetaValue(dom.window.document, 'property="og:published_time"');
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || (publishTime && getLocalDate(publishTime))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'כאן';
const filters = [/\[?\[?כאן\]?\]?/];

export default async function kanDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters);
}
