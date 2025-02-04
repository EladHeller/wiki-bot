import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getContent } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string) {
  const url = `https://www.idf.il/${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    const date = getContent(dom.window.document, '.rating-article > .rating-item')?.trim() ?? '';
    const [day, month, year] = date.split('.');
    if (day && month && year) {
      const fullYear = Number(year) < 25 ? `20${year}` : `19${year}`;
      return getLocalDate(`${fullYear}-${month}-${day}`);
    }
    return '';
  } catch (error) {
    console.log('Failed to get date from page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'אתר צה"ל';

const filters = [
  /\[?\[?אתר צה["״]ל\]?\]?/,
];

export default async function idfSiteDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters);
}
