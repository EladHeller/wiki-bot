import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromCalcalistPage(id: string, title: string) {
  let url = `https://www.calcalist.co.il/articles/0,7340,L-${id},00.html`;
  if (!id.match(/^\d{2,20}$/)) {
    url = `https://www.calcalist.co.il/${id}`;
  }
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getMetaValue(dom.window.document, 'property="article:published_time"');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from calcalist page', url, title);
    return '';
  }
}

const TEMPLATE_NAME = 'כלכליסט';

export default async function calcalistDates() {
  await templateDates(TEMPLATE_NAME, getDateFromCalcalistPage, [/\[?\[?כלכליסט\]?\]?/]);
}
