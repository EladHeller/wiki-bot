import { IWikiApi } from '../wiki/WikiApi';
import { IWikiDataAPI } from '../wiki/WikidataAPI';
import {
  LevelData,
  updateTemplate,
  updateElevationClaim,
} from './utils';

const SEA_OF_GALILEE_ITEM = 'Q126982';
const REFERENCE_URL = 'https://data.gov.il/he/datasets/water_authority/https-www-data-gov-il-dataset-682';

interface KineretLevelRecord {
  Survey_Date: string;
  Kinneret_Level: number;
  _id: number;
}

interface KineretApiResponse {
  result: {
    records: KineretLevelRecord[];
  };
}

interface KineretConfig {
  templatePage: string;
  apiUrl: string;
}

export interface IKineretModel {
  fetchLevelData(): Promise<LevelData>;
  updateWikiTemplate(): Promise<void>;
  updateWikiData(): Promise<void>;
}

function parseDateFromRecord(surveyDate: string): Date {
  const dateMatch = surveyDate.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return new Date(`20${year}-${month}-${day}`);
  }
  return new Date(surveyDate);
}

export default function KineretModel(
  wikiApi: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  config: KineretConfig,
  dataFetcher: (url: string) => Promise<KineretApiResponse>,
  getCurrentDate: () => Date,
): IKineretModel {
  let cachedLevelData: LevelData | null = null;

  async function fetchLevelData(): Promise<LevelData> {
    const levelRes = await dataFetcher(config.apiUrl);
    const record = levelRes.result.records[0];
    const date = parseDateFromRecord(record.Survey_Date);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid date from API');
    }
    cachedLevelData = {
      date,
      level: record.Kinneret_Level.toString().trim(),
    };
    return cachedLevelData;
  }

  async function updateWikiTemplate(): Promise<void> {
    const levelData = cachedLevelData ?? await fetchLevelData();
    await updateTemplate(wikiApi, levelData, config.templatePage, getCurrentDate);
  }

  async function updateWikiData(): Promise<void> {
    const levelData = cachedLevelData ?? await fetchLevelData();
    const { date, level } = levelData;

    await wikiDataApi.login();
    await updateElevationClaim(
      wikiDataApi,
      SEA_OF_GALILEE_ITEM,
      date,
      Number(level),
      REFERENCE_URL,
      'Update Sea of Galilee elevation',
    );
  }

  return {
    fetchLevelData,
    updateWikiTemplate,
    updateWikiData,
  };
}
