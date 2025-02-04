import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromGlobesPage(id: string, title: string) {
  const url = `https://www.globes.co.il/news/article.aspx?did=${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    const displayDate = getMetaValue(dom.window.document, 'property="article:published_time"');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (displayDate && getLocalDate(displayDate))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from globes page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'גלובס';

export default async function globesDates() {
  await templateDates(TEMPLATE_NAME, getDateFromGlobesPage, [/\[?\[?גלובס\]?\]?/]);
}
