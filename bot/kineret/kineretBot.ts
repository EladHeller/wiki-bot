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
export async function getKineretLevelData() {
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

async function getKineretLevel() {
  const updatedResult = await getKineretLevelData();
  return {
    date: updatedResult.date,
    level: updatedResult.level.toString().trim(),
  };
}

export async function updateWikiData(date: Date, level: string) {
  const api = WikiDataAPI();
  await api.login();
  const currentClaim = await api.getClaim(LEVEL_PROPERTY_CLAIM_GUID);
  const currentLevel = Number(currentClaim.mainsnak.datavalue.value.amount);
  const newLevel = Number(level);
  if (Math.abs(currentLevel - newLevel) < 0.05) {
    console.log('No need to update wikidata');
    return;
  }
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
  const urlReference = snaks?.P854[0];
  if (!timeReference || !urlReference) {
    throw new Error('No time or url reference');
  }
  const now = new Date(date);
  now.setHours(0);
  now.setMinutes(0 - now.getTimezoneOffset());
  now.setSeconds(0);
  const formatted = `+${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
  timeReference.datavalue.value.time = formatted;
  urlReference.datavalue.value = 'https://data.gov.il/dataset/https-www-data-gov-il-dataset-682';

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
