import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getContent } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string) {
  const url = `https://www.news1.co.il/Archive/${id}.html`;
  try {
    const dom = await JSDOM.fromURL(url);
    const date1 = getContent(dom.window.document, '#ctl00_ContentMain_UcArticle1_lblCreateDateTop');
    const date2 = getContent(dom.window.document, '#ctl00_ContentMain_UcArticle1_lblCreateDate');
    if (date1 || date2) {
      const [day, month, year] = (date1 || date2 || '').split('/');
      if (day && month && year) {
        return getLocalDate(`${year}-${month}-${day}`);
      }
    }
    return '';
  } catch (error) {
    console.log('Failed to get date from page', url, title, error.message || error.data || error.toString());
    return '';
  }
}

const TEMPLATE_NAME = 'NFC';

// eslint-disable-next-line max-len
const filters = [/\[?\[?NFC\]?\]?/i, /\[?\[?News1( מחלקה ראשונה)?\]?\]?/i, /\[?\[?(חדשות )?מחלקה ראשונה\]?\]?/, /\[?\[?מקור ראשון\]?\]?/];
export default async function nfcDates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, filters);
  // await templateDates(TEMPLATE_NAME, getDateFromPage, filters, 'nfc');
  // await templateDates(TEMPLATE_NAME, getDateFromPage, filters, 'Nfc');
  // await templateDates(TEMPLATE_NAME, getDateFromPage, filters, 'News1');
  // await templateDates(TEMPLATE_NAME, getDateFromPage, filters, 'news1');
}
