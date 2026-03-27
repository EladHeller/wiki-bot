import { JSDOM } from 'jsdom';
import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiApi from '../wiki/WikiApi';
import WikiDataAPI from '../wiki/WikidataAPI';
import KineretModel from './KineretModel';
import DeadSeaModel from './DeadSeaModel';
import { fetchUrlLikeBrowser } from '../utilities';
import { KineretApiResponse } from './utils';

const KINERET_API_URL = 'https://data.gov.il/api/3/action/datastore_search?resource_id=2de7b543-e13d-4e7e-b4c8-56071bc4d3c8&limit=1';
const DEAD_SEA_API_URL = 'https://data.gov.il/api/3/action/datastore_search?resource_id=823479b4-4771-43d8-9189-6a2a1dcaaf10&limit=1';

export const defaultDataFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch data from ${url}`);
  }
  return res.json();
};

export const kineretDataFetcher = async (url: string): Promise<KineretApiResponse> => {
  const res = await fetchUrlLikeBrowser(url);
  const text = await res.text();
  const dom = new JSDOM(text);
  const hieghtElement = dom.window.document.querySelector('.hp_miflas_height');
  const level = hieghtElement?.textContent?.trim();
  const dateElement = dom.window.document.querySelector('.hp_miflas_date');
  const date = dateElement?.textContent?.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!date?.[0] || !level) {
    throw new Error('Failed to parse level or date');
  }
  return {
    result: {
      records: [
        {
          Survey_Date: date[0],
          Kinneret_Level: Number(level),
          _id: 0,
        },
      ],
    },
  };
};

export const getCurrentDate = () => new Date();

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
    shouldUpdateWikiData: true,
  }, defaultDataFetcher, getCurrentDate);

  await kineretModel.fetchLevelData();
  await kineretModel.updateWikiTemplate();
  await kineretModel.updateWikiData();

  await deadSeaModel.fetchLevelData();
  await deadSeaModel.updateWikiTemplate();
  await deadSeaModel.updateWikiData();
}

export const main = botLoggerDecorator(kineretBot, { botName: 'בוט כינרת' });
