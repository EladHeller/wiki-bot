import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const name = process.env.USER_NAME;
const password = process.env.PASSWORD;
const baseUrl = 'https://he.wikipedia.org/w/api.php';

export type WikiPage = {
  pageid: number;
  ns: number;
  templates?: {
    ns: number;
    title: string;
  }[];
  revisions: {
    user: string;
    size: number;
    slots: {
      main: {
        contentmodel: string;
        contentformat: string;
        '*': string;
      }
    }
  }[],
  extlinks: {
    '*': string;
  }[];
  title: string;
  pageprops?: {
    wikibase_item: string;
  }
}

let token: string;

function objectToFormData(obj: Record<string, any>) {
  const fd = new URLSearchParams();
  Object.entries(obj).forEach(([key, val]) => fd.append(key, val));
  return fd;
}

async function getToken() {
  const result = await client(`${baseUrl}?action=query&meta=tokens&type=login&format=json`);
  const { logintoken } = result.data.query.tokens;
  return logintoken;
}

export async function login() {
  const logintoken = await getToken();
  const url = `${baseUrl}`;
  if (!name || !password) {
    throw new Error('Name and password are required');
  }

  const result = await client({
    method: 'post',
    url,
    data: objectToFormData({
      lgname: name,
      lgtoken: logintoken,
      lgpassword: password,
      action: 'login',
      format: 'json',
    }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (result.data.login.result !== 'Success') {
    console.error(result.data.login);
    throw new Error('Failed to login');
  }

  const tokenResult = await client(`${baseUrl}?action=query&meta=tokens&format=json&assert=bot`);
  token = tokenResult.data.query.tokens.csrftoken;
}

export async function getCompany(title: string): Promise<Record<string, WikiPage>> {
  const rvprops = encodeURIComponent('user|size');
  const path = `${baseUrl}?action=query&format=json&rvprop=${
    rvprops
  }&rvslots=*&rvlimit=1&prop=revisions&titles=${
    encodeURIComponent(title)
  }&rvdir=newer`;
  const result = await client(path);
  return result.data.query.pages;
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
  + `&elprotocol=http&elquery=${mayaLink}&ellimit=5000`;
  const result = await client(path);
  return result.data.query.pages;
}

export async function getMayaLinks(withContent = false): Promise<Record<string, WikiPage>> {
  const template = encodeURIComponent('תבנית:מידע בורסאי');
  const props = encodeURIComponent(`extlinks|pageprops${withContent ? '|revisions' : ''}`);
  const mayaLink = encodeURIComponent('maya.tase.co.il/company/');
  const rvprops = encodeURIComponent('content|size');
  const path = `${baseUrl}?action=query&format=json`
  // Pages with תבנית:מידע בורסאי
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
  // wikidata identifier
  + `&ppprop=wikibase_item&redirects=1${
    // Get content of page
    withContent ? `&rvprop=${rvprops}&rvslots=*` : ''
  // Get maya link
  }&elprotocol=http&elquery=${mayaLink}&ellimit=5000`;
  const result = await client(path);
  return result.data.query.pages;
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

export async function updateArticle(articleTitle: string, summary:string, content: string) {
  const queryDetails = {
    method: 'post',
    data: objectToFormData({
      title: articleTitle, text: content, token, summary,
    }),
    url: `${baseUrl}?action=edit&format=json&assert=bot&bot=true`,
  };
  const result = await client(queryDetails);

  return result.data;
}

export async function getArticleContent(title: string): Promise<string | undefined> {
  const path = `${baseUrl}?action=query&format=json&rvprop=content&rvslots=*&prop=revisions&titles=${
    encodeURIComponent(title)
  }`;
  const result = await client(path);
  const wikiPages:Record<string, Partial<WikiPage>> = result.data.query.pages;

  return Object.values(wikiPages)[0]?.revisions?.[0].slots.main['*'];
}

export async function externalUrl(link:string, protocol:string = 'https') {
  const props = encodeURIComponent('revisions|extlinks');
  const rvprops = encodeURIComponent('content');
  const path = `${baseUrl}?action=query&format=json&`
  + `generator=exturlusage&geuprotocol=${protocol}&geunamespace=0&geuquery=${encodeURIComponent(link)}&geulimit=500`
  + `&prop=${props}`
  + `&rvprop=${rvprops}&rvslots=*`;
  const result = await client(path);
  const res:Record<string, Partial<WikiPage>> = result.data.query.pages;

  return Object.values(res);
}

export async function* search(text:string, max = 100, page = 10) {
  const props = encodeURIComponent('revisions|extlinks');
  const rvprops = encodeURIComponent('content');

  const path = `${baseUrl}?action=query&generator=search&format=json&gsrnamespace=0&gsrsearch=${encodeURIComponent(text)}&gsrlimit=${page}`
  + `&prop=${props}`
  + `&rvprop=${rvprops}&rvslots=*`;

  let result = await client(path);
  let count = page;
  while (result.data.continue && count <= max) {
    const res:Record<string, Partial<WikiPage>> = result.data.query.pages;
    yield Object.values(res);
    const path2 = `${path}&gsroffset=${result.data.continue.gsroffset}&continue=${result.data.continue.continue}`;
    result = await client(path2);
    count += page;
  }
  const res:Record<string, Partial<WikiPage>> = result.data.query.pages;

  return Object.values(res);
}

export async function protect(title:string, protections: string, expiry: string, reason: string) {
  const queryDetails = {
    method: 'post',
    data: objectToFormData({
      title, token, expiry, reason, protections,
    }),
    url: `${baseUrl}?action=protect&format=json&assert=bot&bot=true`,
  };
  const result = await client(queryDetails);

  return result.data;
}
