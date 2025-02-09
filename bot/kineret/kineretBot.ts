import 'dotenv/config';
import updateDeadSeaLevel from './deadSeaBot';
import {
  formatDate, updateLevel,
} from './utils';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import WikiDataAPI from '../wiki/WikidataAPI';

// const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{2})/;

const articleName = 'תבנית:מפלס הכנרת';
const apiUrl = 'https://data.gov.il/api/3/action/datastore_search?resource_id=2de7b543-e13d-4e7e-b4c8-56071bc4d3c8&limit=1';
const WIKI_DATA_ITEM = 'Q126982';
const LEVEL_PROPERTY_CLAIM_GUID = `${WIKI_DATA_ITEM}$DA559838-B44B-4A82-8BA4-01E8C0FB41D6`;

interface KinneretLevelRecord {
  Survey_Date: string;
  Kinneret_Level: number;
  _id: number;
}
export async function getKineretLevel1() {
  const levelRes = await fetch(apiUrl).then((res) => res.json());
  const record: KinneretLevelRecord = levelRes.result.records[0];
  console.log('Kinneret level:', record);
  let date = new Date(record.Survey_Date.split('/').reverse().join('/'));
  console.log('date:', date);
  if (Number.isNaN(date.getTime())) {
    date = new Date(record.Survey_Date);
    console.log('date:', date);
  }
  return {
    date,
    level: record.Kinneret_Level,
  };
}

// async function getKineretLevel2() {
//   const kinneretDocument = await fetch('https://kineret.org.il/').then((res) => res.text()).then((html) => new JSDOM(html));
//   const levelElement = kinneretDocument.window.document.querySelector('#hp_miflas');
//   const date = levelElement?.querySelector('.hp_miflas_date')?.textContent?.match(DATE_REGEX);
//   const level = levelElement?.querySelector('.hp_miflas_height')?.textContent;
//   if (!date || !level) {
//     throw new Error('Failed to get kinneret level');
//   }
//   const [, day, month, year] = date;
//   return {
//     date: new Date(`20${year}-${month}-${day}`),
//     level,
//   };
// }

async function getKineretLevel() {
  // const promises = [getKineretLevel1(), getKineretLevel2()];
  // const results = await Promise.all(promises);
  // const updatedResult = results[0].date > results[1].date ? results[0] : results[1];
  const updatedResult = await getKineretLevel1();
  return {
    date: updatedResult.date,
    level: updatedResult.level.toString().trim(),
  };
}

export async function updateWikiData(date: Date, level: string) {
  const api = WikiDataAPI();
  await api.login();

  const revId = await api.getRevId(WIKI_DATA_ITEM);
  const updateRes = await api.setClaimValue(LEVEL_PROPERTY_CLAIM_GUID, {
    amount: level,
    unit: 'http://www.wikidata.org/entity/Q11573',
  }, 'Update Sea of Galilee elevation', revId);
  console.log(updateRes);

  if (updateRes.success !== 1) {
    throw new Error('Failed to update claim');
  }
  const snaks = updateRes.claim.references?.[0].snaks;
  const referenceHash = updateRes.claim.references?.[0].hash;
  if (!snaks || !referenceHash) {
    throw new Error('No references');
  }
  const timeReference = snaks?.P813[0];
  if (!timeReference) {
    throw new Error('No time or url reference');
  }
  const now = new Date(date);
  now.setHours(0);
  now.setMinutes(0 - now.getTimezoneOffset());
  now.setSeconds(0);
  const formatted = `+${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
  timeReference.datavalue.value.time = formatted;

  const setReferenceRes = await api.updateReference(
    LEVEL_PROPERTY_CLAIM_GUID,
    referenceHash,
    snaks,
    'Update Sea of Galilee elevation',
    updateRes.pageinfo.lastrevid,
  );
  console.log(setReferenceRes);
}

async function kineret() {
  const { date, level } = await getKineretLevel();
  await updateLevel({ date: formatDate(date), level }, articleName, '#switch: {{{מאפיין}}}');
  await updateWikiData(date, level);
}

export default async function kinneretBot() {
  await kineret();
  await updateDeadSeaLevel();
}

export const main = shabathProtectorDecorator(kinneretBot);
