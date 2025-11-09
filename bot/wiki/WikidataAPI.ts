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
  setClaim: (claim: WikiDataClaim, summary: string, baserevid: number) => Promise<WikiDataSetClaimResponse>;
  getClaim: (entity: string, property:string) => Promise<WikiDataClaim[]>;
  readEntity: (qid: string, props: string, languages?: string) => Promise<WikiDataEntity>;
  getRevId: (title: string) => Promise<number>;
  updateReference: (claim: string, referenceHash: string,
    snaks: Record<string, WikiDataSnack[]>, summary: string, baserevid: number) =>
      Promise<WikiDataSetReferenceResponse>;
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

  async function setClaim(claim: WikiDataClaim, summary: string, baserevid: number) {
    const params = new URLSearchParams({
      action: 'wbsetclaim',
      format: 'json',
      claim: JSON.stringify(claim),
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

  async function getClaim(entity: string, property: string) {
    const params = new URLSearchParams({
      action: 'wbgetclaims',
      entity,
      property,
      format: 'json',
    });
    const res = await baseApi.request(`?${params.toString()}`);
    const claims = res.claims[property];
    if (!claims || claims.length === 0) {
      throw new Error(`Failed to get claim for ${entity}:${property}`);
    }
    return claims;
  }

  return {
    login,
    setClaimValue,
    setClaim,
    getClaim,
    readEntity,
    getRevId,
    updateReference,
  };
}
