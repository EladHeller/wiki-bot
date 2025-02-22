import {
  WikiApiConfig, WikiDataClaim, WikiDataEntity, WikiDataSetClaimResponse, WikiDataSetReferenceResponse, WikiDataSnack,
  WikiPage,
} from '../types';
import BaseWikiApi from './BaseWikiApi';

const defaultWikiDataConfig: Partial<WikiApiConfig> = {
  baseUrl: 'https://www.wikidata.org/w/api.php',
  password: process.env.PASSWORD,
  userName: process.env.USER_NAME,
  assertBot: false,
};

export interface IWikiDataAPI {
  login: () => Promise<void>;
  setClaimValue: (claim: string, value: any, summary: string, baserevid: number) =>
     Promise<WikiDataSetClaimResponse>;
  getClaim: (id: string) => Promise<WikiDataClaim>;
  readEntity: (qid: string, props: string, languages?: string) => Promise<WikiDataEntity>;
  getRevId: (title: string) => Promise<number>;
  updateReference: (claim: string, referenceHash: string,
    snaks: Record<string, WikiDataSnack[]>, summary: string, baserevid: number) =>
      Promise<WikiDataSetReferenceResponse>;
}

export async function querySql(query: string): Promise<Record<string, string>[]> {
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: {
      'User-Agent': 'Sapper-bot/1.0 (https://he.wikipedia.org/wiki/User:Sapper-bot)',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to query sql: ${await res.text()}`);
  }
  const data = await res.json();
  return data.results.bindings.map(
    (binding: Record<string, { value: string }>) => Object.fromEntries(
      Object.entries(binding).map((entry) => [entry[0], entry[1].value]),
    ),
  );
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

  async function setClaimValue(claim: string, value: any, summary: string, baserevid: number) {
    const params = new URLSearchParams({
      action: 'wbsetclaimvalue',
      snaktype: 'value',
      format: 'json',
      claim,
      value: JSON.stringify(value),
      token,
      summary,
      bot: '1',
      baserevid: baserevid.toString(),
    });
    return baseApi.request('', 'POST', params);
  }

  async function updateReference(
    claim: string,
    referenceHash: string,
    snaks: Record<string, WikiDataSnack[]>,
    summary: string,
    baserevid: number,
  ) {
    const params = new URLSearchParams({
      action: 'wbsetreference',
      format: 'json',
      statement: claim,
      reference: referenceHash,
      snaks: JSON.stringify(snaks),
      bot: '1',
      token,
      summary,
      baserevid: baserevid.toString(),
    });
    return baseApi.request('', 'POST', params);
  }

  async function getRevId(title: string) {
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      format: 'json',
      prop: 'revisions',
      rvlimit: '1',
      rvprop: 'ids',
    });
    const res = await baseApi.request(`?${params.toString()}`);
    const page = Object.values(res.query.pages)[0] as WikiPage;
    const revId = page?.revisions?.[0].revid;
    if (!revId) {
      throw new Error(`Failed to get revid for ${title}`);
    }
    return revId;
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

  async function getClaim(id: string) {
    const params = new URLSearchParams({
      action: 'wbgetclaims',
      claim: id,
      format: 'json',
    });
    const res = await baseApi.request(`?${params.toString()}`);
    const claim = Object.values(res.claims)[0]?.[0];
    if (!claim) {
      throw new Error(`Failed to get claim for ${id}`);
    }
    return claim;
  }

  return {
    login,
    setClaimValue,
    getClaim,
    readEntity,
    getRevId,
    updateReference,
  };
}
