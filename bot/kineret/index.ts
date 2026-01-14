import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiApi from '../wiki/WikiApi';
import WikiDataAPI from '../wiki/WikidataAPI';
import KineretModel from './KineretModel';
import DeadSeaModel from './DeadSeaModel';

const KINERET_API_URL = 'https://data.gov.il/api/3/action/datastore_search?resource_id=2de7b543-e13d-4e7e-b4c8-56071bc4d3c8&limit=1';
const DEAD_SEA_API_URL = 'https://data.gov.il/api/3/action/datastore_search?resource_id=823479b4-4771-43d8-9189-6a2a1dcaaf10&limit=1';

const defaultDataFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch data from ${url}`);
  }
  return res.json();
};

const getCurrentDate = () => new Date();

export default async function kineretBot() {
  const wikiApi = WikiApi();
  const wikiDataApi = WikiDataAPI();

  await wikiApi.login();

  const kineretModel = KineretModel(wikiApi, wikiDataApi, {
    templatePage: 'תבנית:מפלס הכנרת',
    apiUrl: KINERET_API_URL,
  }, defaultDataFetcher, getCurrentDate);

  const deadSeaModel = DeadSeaModel(wikiApi, wikiDataApi, {
    templatePage: 'תבנית:מפלס ים המלח',
    apiUrl: DEAD_SEA_API_URL,
    shouldUpdateWikiData: false,
  }, defaultDataFetcher, getCurrentDate);

  await kineretModel.fetchLevelData();
  await kineretModel.updateWikiTemplate();
  await kineretModel.updateWikiData();

  await deadSeaModel.fetchLevelData();
  await deadSeaModel.updateWikiTemplate();
  await deadSeaModel.updateWikiData();
}

export const main = botLoggerDecorator(kineretBot, { botName: 'בוט כינרת' });
