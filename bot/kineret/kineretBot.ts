import 'dotenv/config';
import { JSDOM } from 'jsdom';
import { login } from '../wikiAPI';
import updateDeadSeaLevel from './deadSeaBot';
import {
  formatDate, updateLevel,
} from './utils';

const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{2})/;

const dataSource = '{{הערה|[http://kineret.org.il רשות ניקוז ונחלים כנרת]}}';

const articleName = 'תבנית:מפלס הכינרת';

async function getKineretLevel() {
  const kinneretDocument = await JSDOM.fromURL('https://kineret.org.il/');
  const levelElement = kinneretDocument.window.document.querySelector('#hp_miflas');
  const date = levelElement?.querySelector('.hp_miflas_date')?.textContent?.match(DATE_REGEX);
  const level = levelElement?.querySelector('.hp_miflas_height')?.textContent;
  if (!date || !level) {
    throw new Error('Failed to get kinneret level');
  }
  const [, day, month, year] = date;
  const dateFormat = formatDate(new Date(`20${year}-${month}-${day}`));
  return {
    date: dateFormat,
    level,
  };
}

async function kineret() {
  const { date, level } = await getKineretLevel();

  await updateLevel({ date, level }, articleName, dataSource, '#switch: {{{Property}}}', 'timestamp', 'level');
}

export async function main() {
  await login();
  await kineret();
  await updateDeadSeaLevel();
}

export default {
  main,
};
