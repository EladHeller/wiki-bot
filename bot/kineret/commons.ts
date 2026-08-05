import BaseWikiApi from '../wiki/BaseWikiApi';
import WikiApi from '../wiki/WikiApi';
import KineretCommonsModel from './KineretCommonsModel';
import { KineretApiResponse } from './utils';

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

export async function kineretHistoryFetcher(url: string): Promise<KineretApiResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Kinneret history from ${url}`);
  }
  return response.json() as Promise<KineretApiResponse>;
}

export default async function updateKineretCommonsGraph() {
  const commonsApi = WikiApi(BaseWikiApi({
    baseUrl: COMMONS_API_URL,
    assertBot: false,
  }));
  return KineretCommonsModel(commonsApi, kineretHistoryFetcher).updateGraph();
}
