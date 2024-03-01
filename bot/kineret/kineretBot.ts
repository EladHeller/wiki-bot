import 'dotenv/config';
import { JSDOM } from 'jsdom';
import updateDeadSeaLevel from './deadSeaBot';
import {
  formatDate, updateLevel,
} from './utils';
import shabathProtectorDecorator from '../decorators/shabathProtector';

const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{2})/;

const articleName = 'תבנית:מפלס הכנרת/נתונים';
// const apiUrl = 'https://data.gov.il/api/3/action/datastore_search?resource_id=2de7b543-e13d-4e7e-b4c8-56071bc4d3c8&limit=1';
// interface KinneretLevelRecord {
//   Survey_Date: string;
//   Kinneret_Level: number;
//   _id: number;
// }
// async function getKineretLevel1() {
//   const levelRes = await fetch(apiUrl).then((res) => res.json());
//   const record: KinneretLevelRecord = levelRes.result.records[0];
//   return {
//     date: new Date(record.Survey_Date),
//     level: record.Kinneret_Level,
//   };
// }

async function getKineretLevel2() {
  const kinneretDocument = await JSDOM.fromURL('https://kineret.org.il/');
  const levelElement = kinneretDocument.window.document.querySelector('#hp_miflas');
  const date = levelElement?.querySelector('.hp_miflas_date')?.textContent?.match(DATE_REGEX);
  const level = levelElement?.querySelector('.hp_miflas_height')?.textContent;
  if (!date || !level) {
    throw new Error('Failed to get kinneret level');
  }
  const [, day, month, year] = date;
  return {
    date: new Date(`20${year}-${month}-${day}`),
    level,
  };
}

async function getKineretLevel() {
  // const promises = [getKineretLevel1(), getKineretLevel2()];
  // const results = await Promise.all(promises);
  // const updatedResult = results[0].date > results[1].date ? results[0] : results[1];
  const updatedResult = await getKineretLevel2();
  return {
    date: formatDate(updatedResult.date),
    level: updatedResult.level.toString().trim(),
  };
}

async function kineret() {
  const { date, level } = await getKineretLevel();
  await updateLevel({ date, level }, articleName, '#switch: {{{מאפיין}}}');
}

async function kinneretBot() {
  await kineret();
  await updateDeadSeaLevel();
}

export const main = shabathProtectorDecorator(kinneretBot);

export default {
  main,
};
