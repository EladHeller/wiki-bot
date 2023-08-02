import { WikiApiConfig } from '../types';
import BaseWikiApi from './BaseWikiApi';

const defaultWikiDataConfig: Partial<WikiApiConfig> = {
  baseUrl: 'https://www.wikidata.org/w/api.php',
  password: process.env.WIKIDATA_PASSWORD,
  userName: process.env.WIKIDATA_USERNAME,
  assertBot: false,
};

export default function NewWikiApi(apiConfig: Partial<WikiApiConfig> = defaultWikiDataConfig) {
  const baseApi = BaseWikiApi(apiConfig);
  let token: string;

  async function init() {
    token = await baseApi.login();
  }
  const tokenPromise = init();

  function login() {
    return tokenPromise;
  }

  function editClaim() {
    return baseApi.request('action=wbsetclaim&format=json', 'POST', {
      token,
    });
  }

  return {
    login,
  };
}
