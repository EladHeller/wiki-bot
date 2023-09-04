import { JSDOM } from 'jsdom';
import { getLocalDate } from '../../../utilities';
import { getMetaValue, getSchemaData } from '../../../scraping';
import templateDates from './templateDates';

async function getDateFromPage(id: string, title: string, section?: string) {
  const url = `https://www.sport5.co.il/articles.aspx?FolderID=${section ?? ''}&docID=${id}&lang=he`;
  try {
    const dom = await JSDOM.fromURL(url);
    const date2 = getMetaValue(dom.window.document, 'property="article:published_time"');
    const datePublished = getSchemaData(dom.window.document, 'NewsArticle')?.datePublished?.toString();
    const date = (datePublished && getLocalDate(datePublished))
    || (date2 && getLocalDate(date2))
    || '';
    return date;
  } catch (error) {
    console.log('Failed to get date from sport5 page', url, title);
    return '';
  }
}

const TEMPLATE_NAME = 'ספורט 5';

export default async function sport5Dates() {
  await templateDates(TEMPLATE_NAME, getDateFromPage, [/\[?\[?ספורט 5\]?\]?/i], 'ספורט 5', (data) => {
    const [,, id, section, date] = data;
    return {
      id,
      date,
      section,
    };
  });
}
