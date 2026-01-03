import updateDeadSeaLevel from './deadSeaBot';
import {
  formatDate, updateLevel,
} from './utils';
import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiDataAPI from '../wiki/WikidataAPI';
import { WikiDataClaim } from '../types';

// const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{2})/;

const articleName = 'תבנית:מפלס הכנרת';
const apiUrl = 'https://data.gov.il/api/3/action/datastore_search?resource_id=2de7b543-e13d-4e7e-b4c8-56071bc4d3c8&limit=1';
const SEA_OF_GALILEE_ITEM = 'Q126982';
// const SANDBOX_ITEM = 'Q4115189';
const ELEVATION_ABOVE_SEA_LEVEL_ID = 'P2044';

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

function isClaimValid(currentClaim: WikiDataClaim) {
  const isUnitValid = currentClaim.mainsnak.datavalue.value.unit === 'http://www.wikidata.org/entity/Q11573';
  const isReferenceValid = currentClaim.references?.length === 1
     && currentClaim.references?.[0].snaks?.P854[0].datavalue.value === 'https://data.gov.il/dataset/https-www-data-gov-il-dataset-682';
  const thereIsTimeReference = currentClaim.references?.[0].snaks?.P813[0].datavalue.value.time;
  return isUnitValid && isReferenceValid && thereIsTimeReference;
}

export async function updateWikiData(date: Date, level: string) {
  const api = WikiDataAPI();
  await api.login();
  const claims = await api.getClaim(SEA_OF_GALILEE_ITEM, ELEVATION_ABOVE_SEA_LEVEL_ID);
  const currentClaim = claims[0];
  if (claims.length !== 1 || !isClaimValid(currentClaim)) {
    throw new Error('Claim is not valid');
  }
  const currentLevel = Number(currentClaim.mainsnak.datavalue.value.amount);
  const newLevel = Number(level);

  if (Math.abs(currentLevel - newLevel) < 0.02) {
    console.log('No need to update wikidata');
    return;
  }
  const revId = await api.getRevId(SEA_OF_GALILEE_ITEM);
  currentClaim.mainsnak.datavalue.value.amount = newLevel.toString();
  if (currentClaim.references?.[0].snaks?.P813[0].datavalue.value.time) {
    const now = new Date(date);
    now.setHours(0);
    now.setMinutes(0 - now.getTimezoneOffset());
    now.setSeconds(0);
    const formatted = `+${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
    currentClaim.references[0].snaks.P813[0].datavalue.value.time = formatted;
  }
  const updateRes = await api.setClaim(currentClaim, 'Update Sea of Galilee elevation', revId);
  if (updateRes.success !== 1) {
    throw new Error('Failed to update wikidata');
  }
  console.log(updateRes);
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

export const main = botLoggerDecorator(kinneretBot, { botName: 'בוט כינרת' });
