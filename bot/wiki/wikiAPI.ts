import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import type { WikiPage } from '../types';
import { objectToFormData, objectToQueryString, promiseSequence } from '../utilities';
import { baseLogin, getToken } from './wikiLogin';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const baseUrl = 'https://he.wikipedia.org/w/api.php';

let token: string;

export async function login() {
  if (token) {
    return;
  }
  const name = process.env.USER_NAME;
  const password = process.env.PASSWORD;
  if (!name || !password) {
    throw new Error('Name and password are required');
  }
  token = await baseLogin(name, password, client, baseUrl);
}

async function request(path: string, method?: string, data?: Record<string, any>): Promise<any> {
  if (!token) {
    await login();
  }
  const queryDetails: Record<string, any> = {
    url: path,
    method: method ?? 'GET',
  };
  if (data) {
    queryDetails.data = data;
  }
  const result = await client(queryDetails);

  if (result.data.error) {
    console.error(result.data.error);
    throw new Error(`Failed to ${method?.toUpperCase() === 'GET' ? 'get data' : 'perform action'}`);
  } else if (result.data.warnings) {
    console.warn(result.data.warnings);
  }
  return result.data;
}

async function* continueQuery(path: string, resultConverterCallback?: (result: any) => any) {
  let result = await request(path);
  while (result.continue) {
    yield resultConverterCallback ? resultConverterCallback(result) : result;
    result = await request(`${path}&${objectToQueryString(result.continue)}`);
  }
  yield resultConverterCallback ? resultConverterCallback(result) : result;
}

export async function getCompany(title: string): Promise<Record<string, WikiPage>> {
  const rvprops = encodeURIComponent('user|size');
  const path = `${baseUrl}?action=query&format=json&rvprop=${
    rvprops
  }&rvslots=*&rvlimit=1&prop=revisions&titles=${
    encodeURIComponent(title)
  }&rvdir=newer`;
  const result = await request(path);
  return result.query.pages;
}

export async function getCompanies(): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי');
  const template2 = encodeURIComponent('תבנית:חברה מסחרית');
  const props = encodeURIComponent('templates|revisions|extlinks');
  const rvprops = encodeURIComponent('content|size');
  const mayaLink = encodeURIComponent('maya.tase.co.il/company/');
  const path = `${baseUrl}?action=query&format=json`
  // Pages with תבנית:מידע בורסאי
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
  // This page contains תבנית:חברה מסחרית?
  + `&tltemplates=${template2}&tllimit=500`
  // Get content of page
  + `&rvprop=${rvprops}&rvslots=*`
  // Get maya link
  + `&elprotocol=https&elquery=${mayaLink}&ellimit=5000`;
  const result = await request(path);
  return result.query.pages;
}

export async function getMayaLinks(withContent = false): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי');
  const props = encodeURIComponent(`extlinks|pageprops${withContent ? '|revisions' : ''}`);
  const mayaLink = encodeURIComponent('maya.tase.co.il/company/');
  const rvprops = encodeURIComponent('content|size');
  const path = `${baseUrl}?action=query&format=json`
  // Pages with תבנית:מידע בורסאי
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}&ellimit=5000`
  // wikidata identifier
  + `&ppprop=wikibase_item&redirects=1${
    // Get content of page
    withContent ? `&rvprop=${rvprops}&rvslots=*` : ''
  // Get maya link
  }&elprotocol=https&elquery=${mayaLink}&ellimit=5000`;
  const result = await request(path);
  return result.query.pages;
}

export async function getGoogleFinanceLinksWithContent(): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי (ארצות הברית)');
  const template2 = encodeURIComponent('תבנית:חברה מסחרית');
  const props = encodeURIComponent('templates|revisions|extlinks');
  const googleFinanceLink = encodeURIComponent('www.google.com/finance?q=');
  const rvprops = encodeURIComponent('content|size');
  const path = `${baseUrl}?action=query&format=json`
  // Pages with תבנית:מידע בורסאי (ארצות הברית)'
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
    // This page contains תבנית:חברה מסחרית?
    + `&tltemplates=${template2}&tllimit=500`
  // Get content of page
  + `&rvprop=${rvprops}&rvslots=*`
  // Get google link
  + `&elprotocol=https&elquery=${googleFinanceLink}&ellimit=5000`;
  const result = await client(path);
  return result.data.query.pages;
}

export async function* getArticlesWithTemplate(
  templateName: string,
): AsyncGenerator<WikiPage[], void, WikiPage[]> {
  const template = encodeURIComponent(templateName);
  const props = encodeURIComponent('revisions');
  const rvprops = encodeURIComponent('content');
  const path = `${baseUrl}?action=query&format=json`
  // Pages with template
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
  // Get content of page
  + `&rvprop=${rvprops}&rvslots=*`;
  yield* continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
}

export async function getArticleWithKipaTemplate(): Promise<WikiPage[]> {
  const template = encodeURIComponent('תבנית:כיפה');
  const props = encodeURIComponent('revisions');
  const rvprops = encodeURIComponent('content');
  const path = `${baseUrl}?action=query&format=json`
  // Pages with כיפה'
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
  // Get content of page
  + `&rvprop=${rvprops}&rvslots=*`;
  let pages: WikiPage[] = [];
  let result = await client(path);
  const firstResult = Object.values(result.data.query.pages) satisfies WikiPage[];
  pages = firstResult;
  while (result.data.continue) {
    result = await client(`${path}&elcontinue=${result.data.continue.elcontinue}&rvcontinue=${result.data.continue.rvcontinue}&continue=${result.data.continue.continue}`);
    pages = pages.concat(Object.values(result.data.query.pages));
  }
  const finalResults = pages.filter((page) => page.revisions?.[0]?.slots.main['*'].includes('{{כיפה'));
  firstResult.forEach((page) => {
    if (!finalResults.find((p) => p.pageid === page.pageid)) {
      console.log(page.title);
    }
  });
  return finalResults;
}

export async function getGoogleFinanceLinks(): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי (ארצות הברית)');
  const props = encodeURIComponent('extlinks');
  const googleFinanceLink = encodeURIComponent('www.google.com/finance?q=');
  const path = `${baseUrl}?action=query&format=json`
  // Pages with תבנית:מידע בורסאי (ארצות הברית)'
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
  // Get google link
  + `&elprotocol=https&elquery=${googleFinanceLink}&ellimit=5000`;
  const result = await client(path);
  return result.data.query.pages;
}

export async function updateArticle(
  articleTitle: string,
  summary:string,
  content: string,
  newSectionTitle?: string,
) {
  const data: Record<string, string> = {
    title: articleTitle, text: content, token, summary,
  };
  if (newSectionTitle) {
    data.sectiontitle = newSectionTitle;
    data.section = 'new';
  }

  return request(`${baseUrl}?action=edit&format=json&assert=bot&bot=true`, 'post', objectToFormData(data));
}

export async function getArticleContent(title: string): Promise<string | undefined> {
  const path = `${baseUrl}?action=query&format=json&rvprop=content&rvslots=*&prop=revisions&titles=${
    encodeURIComponent(title)
  }`;
  const result = await request(path);
  const wikiPages:Record<string, Partial<WikiPage>> = result.query.pages;

  return Object.values(wikiPages)[0]?.revisions?.[0].slots.main['*'];
}

export async function externalUrl(link:string, protocol:string = 'https') {
  const props = encodeURIComponent('revisions|extlinks');
  const rvprops = encodeURIComponent('content');
  const path = `${baseUrl}?action=query&format=json&`
  + `generator=exturlusage&geuprotocol=${protocol}&geunamespace=0&geuquery=${encodeURIComponent(link)}&geulimit=500`
  + `&prop=${props}`
  + `&rvprop=${rvprops}&rvslots=*`;
  const result = await request(path);
  const res:Record<string, Partial<WikiPage>> = result.query?.pages ?? {};

  return Object.values(res);
}

export async function* search(text:string) {
  const props = encodeURIComponent('revisions|extlinks');
  const rvprops = encodeURIComponent('content');

  const path = `${baseUrl}?action=query&generator=search&format=json&gsrnamespace=0&gsrsearch=${encodeURIComponent(text)}&gsrlimit=500`
  + `&prop=${props}`
  + `&rvprop=${rvprops}&rvslots=*`;

  yield* continueQuery(path);
}

export async function* getRedirects(namespace = 0, linkNamespace = [0]) {
  const props = encodeURIComponent('links|templates|categories|revisions');
  const template = encodeURIComponent('תבנית:הפניה לא למחוק');
  const category = encodeURIComponent('קטגוריה:הפניות לא למחוק');
  const path = `${baseUrl}?action=query&format=json&generator=allpages&gaplimit=500&gapfilterredir=redirects&gapnamespace=${namespace}`
  + `&prop=${props}&plnamespace=${encodeURIComponent(linkNamespace.join('|'))}&tltemplates=${template}&clcategories=${category}`
  + '&rvprop=timestamp';
  yield* continueQuery(path);
}

export async function getRevisions(title: string, limit = 500): Promise<WikiPage> {
  const path = `${baseUrl}?action=query&format=json&prop=revisions&titles=${encodeURIComponent(title)}&rvprop=timestamp&rvslots=*&rvlimit=${limit}`;
  const res = await request(path);
  return Object.values(res.query.pages)[0] as WikiPage;
}

export async function info(titles:string[]) {
  if (titles.length > 500) {
    throw new Error('Too many titles');
  }
  const props = encodeURIComponent('protection');
  const encodedTitles = encodeURIComponent(titles.join('|'));
  const path = `${baseUrl}?action=query&format=json&prop=info&inprop=${props}&titles=${encodedTitles}`;
  const result = await request(path);
  const res:Record<string, Partial<WikiPage>> = result.query?.pages;
  return Object.values(res);
}

export async function purge(titles: string[]) {
  if (titles.length > 500) {
    throw new Error('Too many titles');
  }
  return request(`${baseUrl}?action=purge&format=json`, 'post', objectToFormData({
    titles: titles.join('|'),
  }));
}

export async function rollback(title: string, user: string, summary: string) {
  const { rollbacktoken } = await getToken(client, baseUrl, 'rollback');
  const path = `${baseUrl}?action=rollback&format=json`;

  return request(path, 'post', objectToFormData({
    token: rollbacktoken,
    summary,
    user,
    title,
    markbot: true,
  }));
}

export async function undo(title: string, summary: string, revision: number) {
  const path = `${baseUrl}?action=edit&format=json`;

  return request(path, 'post', objectToFormData({
    token,
    summary,
    title,
    undo: revision,
    bot: true,
  }));
}

export async function* userContributes(user:string, limit = 500) {
  const props = encodeURIComponent('title|ids');
  const path = `${baseUrl}?action=query&format=json&list=usercontribs&ucuser=${encodeURIComponent(user)}&uclimit=${limit}&ucprop=${props}`;
  yield* continueQuery(path);
}

export async function rollbackUserContributions(user:string, summary: string, count = 5) {
  if (count > 500) {
    throw new Error('Too many titles');
  }
  const { value } = await userContributes(user, count).next();
  const contributes = value.query.usercontribs;
  await promiseSequence(30, contributes.map((contribute) => async () => {
    await rollback(contribute.title, user, summary);
  }));
}

export async function* listCategory(category: string, limit = 500) {
  const props = encodeURIComponent('title|sortkeyprefix');
  const path = `${baseUrl}?action=query&format=json&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmlimit=${limit}&cmprop=${props}`;
  yield* continueQuery(path);
}

export async function categroyPages(category: string, limit = 500): Promise<WikiPage[]> {
  const rvprops = encodeURIComponent('content|size');
  const props = encodeURIComponent('title|sortkeyprefix');
  const path = `${baseUrl}?action=query&format=json&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmlimit=${limit}&gcmprop=${props}`
  + `&prop=revisions&rvprop=${rvprops}&rvslots=*`;

  const pagesObject = await request(path);
  return Object.values(pagesObject?.query?.pages ?? []);
}

export async function* categoriesStartsWith(prefix: string) {
  const path = `${baseUrl}?action=query&format=json&list=allcategories&acprop=size&acprefix=${encodeURIComponent(prefix)}&aclimit=5000`;
  yield* continueQuery(path);
}

export async function undoContributions(user:string, summary: string, count = 5) {
  if (count > 500) {
    throw new Error('Too many titles');
  }
  const { value } = await userContributes(user, count).next();
  const contributes = value.query.usercontribs;
  await promiseSequence(30, contributes.map((contribute) => async () => {
    await undo(contribute.title, summary, contribute.revid);
  }));
}

export async function* fileUsage(pageIds: string[], limit = 500) {
  const props = encodeURIComponent('title|ids');
  const pageIdsString = encodeURIComponent(pageIds.join('|'));
  const path = `${baseUrl}?action=query&format=json&list=fileusage&fuprop=${props}&fulimit=${limit}&pageids=${pageIdsString}`;

  yield* continueQuery(path);
}

export async function protect(title:string, protections: string, expiry: string, reason: string) {
  return request(`${baseUrl}?action=protect&format=json&assert=bot`, 'post', objectToFormData({
    title, token, expiry, reason, protections,
  }));
}

export async function deletePage(title:string, reason: string) {
  const queryDetails = {
    method: 'post',
    data: objectToFormData({
      title, token, reason,
    }),
    url: `${baseUrl}?action=delete&format=json&assert=bot`,
  };
  return request(queryDetails.url, queryDetails.method, queryDetails.data);
}
