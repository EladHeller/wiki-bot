import { WikiPage } from '../types';
import { IWikiApi } from './WikiApi';

const mayaLinkRegex = /^https?:\/\/maya\.tase\.co\.il\/company\/(\d*)\?view=reports$/;

export async function getMayaLinks(api: IWikiApi, withContent = false): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי');
  const props = encodeURIComponent(`extlinks|pageprops${withContent ? '|revisions' : ''}`);
  const mayaLink = encodeURIComponent('maya.tase.co.il/company/');
  const rvprops = encodeURIComponent('content|size|ids');
  const path = '?action=query&format=json'
  // Pages with תבנית:מידע בורסאי
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}&ellimit=5000`
  // wikidata identifier
  + `&ppprop=wikibase_item&redirects=1${
    // Get content of page
    withContent ? `&rvprop=${rvprops}&rvslots=*` : ''
  // Get maya link
  }&elprotocol=https&elquery=${mayaLink}&ellimit=5000`;
  const result = await api.request(path);
  return result.query.pages;
}

export async function getGoogleFinanceLinks(api: IWikiApi): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי (ארצות הברית)');
  const props = encodeURIComponent('extlinks');
  const googleFinanceLink = encodeURIComponent('www.google.com/finance?q=');
  const path = '?action=query&format=json'
  // Pages with תבנית:מידע בורסאי (ארצות הברית)'
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
  // Get google link
  + `&elprotocol=https&elquery=${googleFinanceLink}&ellimit=5000`;
  const result = await api.request(path);
  return result.query.pages;
}

export async function getGoogleFinanceLinksWithContent(api: IWikiApi): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי (ארצות הברית)');
  const template2 = encodeURIComponent('תבנית:חברה מסחרית');
  const props = encodeURIComponent('templates|revisions|extlinks');
  const googleFinanceLink = encodeURIComponent('www.google.com/finance?q=');
  const rvprops = encodeURIComponent('content|size|ids');
  const path = '?action=query&format=json'
  // Pages with תבנית:מידע בורסאי (ארצות הברית)'
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
    // This page contains תבנית:חברה מסחרית?
    + `&tltemplates=${template2}&tllimit=500`
  // Get content of page
  + `&rvprop=${rvprops}&rvslots=*`
  // Get google link
  + `&elprotocol=https&elquery=${googleFinanceLink}&ellimit=5000`;
  const result = await api.request(path);
  return result.query.pages;
}

export function getMayaCompanyIdFromWikiPage(wikiPage: Partial<WikiPage>): string | undefined {
  const companyId = wikiPage.extlinks?.map((link) => link['*'].match(mayaLinkRegex)?.[1]).find((x) => x);
  return companyId;
}
