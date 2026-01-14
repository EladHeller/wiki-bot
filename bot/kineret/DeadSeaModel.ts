import { IWikiApi } from '../wiki/WikiApi';
import { IWikiDataAPI } from '../wiki/WikidataAPI';
import { WikiDataClaim } from '../types';
import {
  METER_UNIT,
  ELEVATION_ABOVE_SEA_LEVEL_ID,
  LevelData,
  updateTemplate,
  updateElevationClaim,
  formatWikiDataDate,
} from './utils';
import { logger } from '../utilities/logger';

const DEAD_SEA_ITEM = 'Q23883';
const ISRAEL_ITEM = 'Q801';
const JORDAN_ITEM = 'Q810';
const ASIA_ITEM = 'Q48';
const LOWEST_POINT_ID = 'P1589';
const REFERENCE_URL = 'https://data.gov.il/he/datasets/water_authority/https-www-data-gov-il-dataset-683';

const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{4})/;

interface DeadSeaLevelRecord {
  'תאריך מדידה': string;
  מפלס: number;
  _id: number;
}

interface DeadSeaApiResponse {
  result: {
    records: DeadSeaLevelRecord[];
  };
}

interface DeadSeaConfig {
  templatePage: string;
  apiUrl: string;
  shouldUpdateWikiData: boolean;
}

export interface IDeadSeaModel {
  fetchLevelData(): Promise<LevelData>;
  updateWikiTemplate(): Promise<void>;
  updateWikiData(): Promise<void>;
}

interface ValidLowestPointData {
  qualifier: { datavalue: { value: { amount: string } } };
  timeRefValue: { time: string };
}

function getValidLowestPointData(currentClaim: WikiDataClaim, referenceUrl: string): ValidLowestPointData | null {
  const qualifier = currentClaim.qualifiers?.[ELEVATION_ABOVE_SEA_LEVEL_ID]?.[0];
  if (!qualifier || qualifier.datavalue?.value?.unit !== METER_UNIT) {
    return null;
  }
  const isReferenceValid = currentClaim.references?.length === 1
    && currentClaim.references?.[0].snaks?.P854?.[0]?.datavalue?.value === referenceUrl;
  const timeRefValue = currentClaim.references?.[0].snaks?.P813?.[0]?.datavalue?.value;
  if (!isReferenceValid || !timeRefValue?.time) {
    return null;
  }
  return { qualifier, timeRefValue };
}

export default function DeadSeaModel(
  wikiApi: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  config: DeadSeaConfig,
  dataFetcher: (url: string) => Promise<DeadSeaApiResponse>,
  getCurrentDate: () => Date,
): IDeadSeaModel {
  let cachedLevelData: LevelData | null = null;

  async function fetchLevelData(): Promise<LevelData> {
    const levelRes = await dataFetcher(config.apiUrl);
    const record = levelRes.result.records[0];
    const dateMatch = record['תאריך מדידה'].match(DATE_REGEX);
    if (!dateMatch) {
      throw new Error('Failed to parse date from API');
    }
    const [, day, month, year] = dateMatch;
    cachedLevelData = {
      date: new Date(`${year}-${month}-${day}`),
      level: record.מפלס.toString().trim(),
    };
    return cachedLevelData;
  }

  async function updateWikiTemplate(): Promise<void> {
    const levelData = cachedLevelData ?? await fetchLevelData();
    await updateTemplate(wikiApi, levelData, config.templatePage, getCurrentDate);
  }

  async function updateLowestPointClaim(itemId: string, itemName: string, date: Date, level: number): Promise<void> {
    const claims = await wikiDataApi.getClaim(itemId, LOWEST_POINT_ID);
    if (claims.length !== 1) {
      throw new Error(`${itemName} lowest point claim is not valid`);
    }

    const deadSeaClaim = claims[0];
    const lowestPointData = getValidLowestPointData(deadSeaClaim, REFERENCE_URL);
    if (!lowestPointData) {
      throw new Error(`${itemName} lowest point claim is not valid`);
    }

    const { qualifier, timeRefValue } = lowestPointData;
    const currentLevel = Number(qualifier.datavalue.value.amount);
    if (Math.abs(currentLevel - level) < 0.02) {
      return;
    }

    const revId = await wikiDataApi.getRevId(itemId);
    qualifier.datavalue.value.amount = level.toString();
    timeRefValue.time = formatWikiDataDate(date);

    const updateRes = await wikiDataApi.setClaim(deadSeaClaim, `Update ${itemName} lowest point elevation`, revId);
    if (updateRes.success !== 1) {
      throw new Error(`Failed to update ${itemName} lowest point elevation`);
    }
  }

  async function updateWikiData(): Promise<void> {
    if (!config.shouldUpdateWikiData) {
      return;
    }

    const levelData = cachedLevelData ?? await fetchLevelData();
    const { date, level } = levelData;
    const numericLevel = Number(level);

    await wikiDataApi.login();
    await updateElevationClaim(
      wikiDataApi,
      DEAD_SEA_ITEM,
      date,
      numericLevel,
      REFERENCE_URL,
      'Update Dead Sea elevation',
    );

    const itemsToUpdate = [
      { id: ASIA_ITEM, name: 'Asia' },
      { id: ISRAEL_ITEM, name: 'Israel' },
      { id: JORDAN_ITEM, name: 'Jordan' },
    ];

    for (const item of itemsToUpdate) {
      try {
        await updateLowestPointClaim(item.id, item.name, date, numericLevel);
      } catch {
        logger.logError(`Failed to update ${item.name} lowest point elevation`);
      }
    }
  }

  return {
    fetchLevelData,
    updateWikiTemplate,
    updateWikiData,
  };
}
