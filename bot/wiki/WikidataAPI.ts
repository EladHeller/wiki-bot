import { WikiApiConfig } from '../types';
import BaseWikiApi from './BaseWikiApi';

const defaultWikiDataConfig: Partial<WikiApiConfig> = {
  baseUrl: 'https://www.wikidata.org/w/api.php',
  password: process.env.PASSWORD,
  userName: process.env.USER_NAME,
  assertBot: false,
};

export interface IWikiDataAPI {
  login: () => Promise<void>;
  setClaim: (claim: string, summary: string) => Promise<any>;
  readEntity: (qid: string, props: string, languages?: string) => Promise<any>;
}

export default function WikiDataAPI(apiConfig: Partial<WikiApiConfig> = defaultWikiDataConfig): IWikiDataAPI {
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

  async function readEntity(qid: string, props: string, languages?: string) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: qid,
      format: 'json',
      languages: languages ?? 'en',
      props,
    });

    const res = await baseApi.request(`?${params.toString()}`);
    return res.entities[qid];
  }

  return {
    login,
    setClaim,
    readEntity,
  };
}
