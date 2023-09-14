import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getContent } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string, section?: string) {
  const url = `https://www.makorrishon.co.il/nrg/online/${section}/ART${id}.html`;
  try {
    const dom = await JSDOM.fromURL(url);
    const dateText = getContent(dom.window.document, '#articleCBar > .cdat, .article-autor > .cdat, #article-autor > .cdat, .newsVitzCredit') ?? '';
    const dateMatch = dateText.match(/(?<day>\d{1,2})\/(?<month>\d{1,2})\/(?<year>\d{4})/);
    const { year, month, day } = dateMatch?.groups ?? {};
    if (year && month && day) {
      return getLocalDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
    console.log('Failed to get date from page', url, title);
    return '';
  } catch (error) {
    console.log('Failed to get date from page', url, title);
    return '';
  }
}

const TEMPLATE_NAME = 'Nrg';
const dataToDate = (data) => {
  const [,, id, date, section, art] = data;
  return {
    id: `${art ?? ''}/${id}`,
    date,
    section,
  };
};

const filters = [/\[?\[?nrg\]?\]?/i, /\[?\[?זמן ירושלים\]?\]?/];

export default async function nrgDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters, undefined, dataToDate);
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters, 'nrg', dataToDate);
}
