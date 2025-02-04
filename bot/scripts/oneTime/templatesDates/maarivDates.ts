import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getSchemaData } from '../../../scraping';
import templateDates from './templateDates';
import appendDatesToTepmlate from './appendDatesToTepmlate';

async function getDateFromMaarivPage(id: string, title: string) {
  const url = `https://www.maariv.co.il/${id}`;
  try {
    const dom = await JSDOM.fromURL(url);
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from maariv page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'מעריב אונליין';

export default async function maarivDates() {
  await appendDatesToTepmlate(TEMPLATE_NAME, getDateFromMaarivPage);
  await templateDates(TEMPLATE_NAME, getDateFromMaarivPage, [/\[?\[?מעריב( אונליין)?\]?\]?/]);
}
