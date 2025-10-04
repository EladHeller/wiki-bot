import {
  formatDate, updateLevel,
} from './utils';
import WikiDataAPI from '../wiki/WikidataAPI';
import { WikiDataClaim } from '../types';

const apiUrl = 'https://data.gov.il/api/3/action/datastore_search?resource_id=823479b4-4771-43d8-9189-6a2a1dcaaf10&limit=1';

interface DeadSeaLevelRecord {
    'תאריך מדידה': string;
    'מפלס' : number;
    _id: number;
}

const articleName = 'תבנית:מפלס ים המלח';

const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{4})/;

// Wikidata constants
const DEAD_SEA_ITEM = 'Q23883';
const ISRAEL_ITEM = 'Q801';
const JORDAN_ITEM = 'Q810';
const ASIA_ITEM = 'Q48';
const ELEVATION_ABOVE_SEA_LEVEL_ID = 'P2044';
const LOWEST_POINT_ID = 'P1589';

async function getDeadSeaLevel() {
  const levelRes = await fetch(apiUrl).then((res) => res.json());
  const record: DeadSeaLevelRecord = levelRes.result.records[0];
  const date = record['תאריך מדידה'].match(DATE_REGEX);
  if (!date) {
    throw new Error('Failed to get dead sea level');
  }
  const [, day, month, year] = date;
  return {
    date: new Date(`${year}-${month}-${day}`),
    level: record['מפלס'].toString().trim(),
  };
}

function isDeadSeaClaimValid(currentClaim: WikiDataClaim) {
  const isUnitValid = currentClaim.mainsnak.datavalue.value.unit === 'http://www.wikidata.org/entity/Q11573';
  const isReferenceValid = currentClaim.references?.length === 1
     && currentClaim.references?.[0].snaks?.P854[0].datavalue.value === 'https://data.gov.il/dataset/https-www-data-gov-il-dataset-683';
  const thereIsTimeReference = currentClaim.references?.[0].snaks?.P813[0].datavalue.value.time;
  return isUnitValid && isReferenceValid && thereIsTimeReference;
}

async function updateDeadSeaElevation(api: any, date: Date, level: number) {
  const claims = await api.getClaim(DEAD_SEA_ITEM, ELEVATION_ABOVE_SEA_LEVEL_ID);
  const currentClaim = claims[0];

  if (claims.length !== 1 || !isDeadSeaClaimValid(currentClaim)) {
    throw new Error('Dead Sea elevation claim is not valid');
  }

  const currentLevel = Number(currentClaim.mainsnak.datavalue.value.amount);
  const newLevel = level;

  if (Math.abs(currentLevel - newLevel) < 0.02) {
    console.log('No need to update Dead Sea elevation in Wikidata');
    return;
  }

  const revId = await api.getRevId(DEAD_SEA_ITEM);
  currentClaim.mainsnak.datavalue.value.amount = newLevel.toString();

  if (currentClaim.references?.[0].snaks?.P813[0].datavalue.value.time) {
    const now = new Date(date);
    now.setHours(0);
    now.setMinutes(0 - now.getTimezoneOffset());
    now.setSeconds(0);
    const formatted = `+${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
    currentClaim.references[0].snaks.P813[0].datavalue.value.time = formatted;
  }

  const updateRes = await api.setClaim(currentClaim, 'Update Dead Sea elevation', revId);
  if (updateRes.success !== 1) {
    throw new Error('Failed to update Dead Sea elevation in Wikidata');
  }
  console.log('Dead Sea elevation updated:', updateRes);
}

async function updateLowestPointClaim(api: any, itemId: string, itemName: string, date: Date, level: number) {
  try {
    const claims = await api.getClaim(itemId, LOWEST_POINT_ID);

    // Find the claim that references the Dead Sea
    const deadSeaClaim = claims.find((claim: WikiDataClaim) => claim.mainsnak.datavalue?.value?.id === DEAD_SEA_ITEM);

    if (!deadSeaClaim) {
      console.log(`No Dead Sea lowest point claim found for ${itemName} (${itemId})`);
      return;
    }

    // Check if there's an elevation qualifier
    const elevationQualifier = deadSeaClaim.qualifiers?.[ELEVATION_ABOVE_SEA_LEVEL_ID]?.[0];

    if (!elevationQualifier) {
      console.log(`No elevation qualifier found for ${itemName} lowest point claim`);
      return;
    }

    const currentLevel = Number(elevationQualifier.datavalue.value.amount);
    const newLevel = level;

    if (Math.abs(currentLevel - newLevel) < 0.02) {
      console.log(`No need to update ${itemName} lowest point elevation`);
      return;
    }

    const revId = await api.getRevId(itemId);
    elevationQualifier.datavalue.value.amount = newLevel.toString();

    const updateRes = await api.setClaim(deadSeaClaim, `Update ${itemName} lowest point elevation`, revId);
    if (updateRes.success !== 1) {
      throw new Error(`Failed to update ${itemName} lowest point elevation`);
    }
    console.log(`${itemName} lowest point elevation updated:`, updateRes);
  } catch (error) {
    console.error(`Error updating ${itemName} lowest point:`, error);
    // Don't throw - continue with other updates
  }
}

export async function updateDeadSeaWikiData(date: Date, level: number) {
  const api = WikiDataAPI();
  await api.login();

  // Update Dead Sea elevation
  await updateDeadSeaElevation(api, date, level);

  // Update lowest point claims for countries/continents
  const itemsToUpdate = [
    { id: ISRAEL_ITEM, name: 'Israel' },
    { id: JORDAN_ITEM, name: 'Jordan' },
    { id: ASIA_ITEM, name: 'Asia' },
  ];

  for (const item of itemsToUpdate) {
    await updateLowestPointClaim(api, item.id, item.name, date, level);
  }
}

export default async function updateDeadSeaLevel() {
  const {
    date, level,
  } = await getDeadSeaLevel();

  await updateLevel({ date: formatDate(date), level }, articleName, '#switch: {{{מאפיין}}}');
  await updateDeadSeaWikiData(date, Number(level));
}
