import { WikiApiConfig } from '../types';
import BaseWikiApi from './BaseWikiApi';

const defaultWikiDataConfig: Partial<WikiApiConfig> = {
  baseUrl: 'https://www.wikidata.org/w/api.php',
  password: process.env.WIKIDATA_PASSWORD,
  userName: process.env.WIKIDATA_USERNAME,
  assertBot: false,
};

export default function WikidataAPI(apiConfig: Partial<WikiApiConfig> = defaultWikiDataConfig) {
  const baseApi = BaseWikiApi(apiConfig);
  let token: string;

  async function init() {
    token = await baseApi.login();
  }
  const tokenPromise = init();

  function login() {
    return tokenPromise;
  }

  function setClaim(claim: string, summary: string) {
    return baseApi.request(`?action=wbsetclaim&format=json&claim=${claim}&summary=${summary}&bot=true`, 'POST', {
      token,
    });
  }

  return {
    login,
    setClaim,
  };
}
