import { getLocalDate } from '../../../utilities';
import templateDates from './templateDates';

async function getDateFromInnPage(id: string, title: string) {
  const url = `https://www.inn.co.il/Generic/NewAPI/Item?type=0&Item=${id}&preview=0`;
  try {
    const data = await fetch(url).then((res) => res.json());
    const date = data.FirstUpdate || data.ItemDate;
    return date ? getLocalDate(date) : '';
  } catch (error) {
    console.log('Failed to get date from inn page', url, title);
    return '';
  }
}

const TEMPLATE_NAME = 'ערוץ7';

export default async function innDates() {
  await templateDates(TEMPLATE_NAME, getDateFromInnPage, [/\[?\[?ערוץ 7\]?\]?/]);
}
