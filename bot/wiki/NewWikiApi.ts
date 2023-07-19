import { WikiApiConfig, WikiPage } from '../types';
import { objectToFormData, promiseSequence } from '../utilities';
import BaseWikiApi, { defaultConfig } from './BaseWikiApi';

export default function NewWikiApi(apiConfig: Partial<WikiApiConfig> = defaultConfig) {
  const baseApi = BaseWikiApi(apiConfig);
  let token: string;

  async function init() {
    token = await baseApi.login();
  }
  const tokenPromise = init();

  async function request(path: string, method?: string, data?: Record<string, any>): Promise<any> {
    await tokenPromise;
    return baseApi.request(path, method, data);
  }

  async function getWikiDataItem(title: string): Promise<string | undefined> {
    const path = `?action=query&format=json&prop=pageprops&titles=${encodeURIComponent(title)}`;
    const result = await request(path);
    const res:Record<string, Partial<WikiPage>> = result.query.pages;

    return Object.values(res)[0]?.pageprops?.wikibase_item;
  }

  async function getCompany(title: string): Promise<Record<string, WikiPage>> {
    const rvprops = encodeURIComponent('user|size');
    const path = `?action=query&format=json&rvprop=${
      rvprops
    }&rvslots=*&rvlimit=1&prop=revisions&titles=${
      encodeURIComponent(title)
    }&rvdir=newer`;
    const result = await request(path);
    return result.query.pages;
  }

  async function getCompanies(): Promise<Record<string, WikiPage>> {
    const template = encodeURIComponent('תבנית:מידע בורסאי');
    const template2 = encodeURIComponent('תבנית:חברה מסחרית');
    const props = encodeURIComponent('templates|revisions|extlinks');
    const rvprops = encodeURIComponent('content|size');
    const mayaLink = encodeURIComponent('maya.tase.co.il/company/');
    const path = '?action=query&format=json'
    // Pages with תבנית:מידע בורסאי
    + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
    + `&prop=${props}`
    // This page contains תבנית:חברה מסחרית?
    + `&tltemplates=${template2}&tllimit=500`
    // Get content of page
    + `&rvprop=${rvprops}&rvslots=*`
    // Get maya link
    + `&elprotocol=http&elquery=${mayaLink}&ellimit=5000`;
    const result = await request(path);
    return result.query.pages;
  }

  async function getMayaLinks(withContent = false): Promise<Record<string, WikiPage>> {
    const template = encodeURIComponent('תבנית:מידע בורסאי');
    const props = encodeURIComponent(`extlinks|pageprops${withContent ? '|revisions' : ''}`);
    const mayaLink = encodeURIComponent('maya.tase.co.il/company/');
    const rvprops = encodeURIComponent('content|size');
    const path = '?action=query&format=json'
    // Pages with תבנית:מידע בורסאי
    + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
    + `&prop=${props}&ellimit=5000`
    // wikidata identifier
    + `&ppprop=wikibase_item&redirects=1${
      // Get content of page
      withContent ? `&rvprop=${rvprops}&rvslots=*` : ''
    // Get maya link
    }&elprotocol=http&elquery=${mayaLink}&ellimit=5000`;
    const result = await request(path);
    return result.query.pages;
  }

  async function getGoogleFinanceLinksWithContent(): Promise<Record<string, WikiPage>> {
    const template = encodeURIComponent('תבנית:מידע בורסאי (ארצות הברית)');
    const template2 = encodeURIComponent('תבנית:חברה מסחרית');
    const props = encodeURIComponent('templates|revisions|extlinks');
    const googleFinanceLink = encodeURIComponent('www.google.com/finance?q=');
    const rvprops = encodeURIComponent('content|size');
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
    const result = await request(path);
    return result.query.pages;
  }

  async function* getArticlesWithTemplate(
    templateName: string,
  ): AsyncGenerator<WikiPage[], void, WikiPage[]> {
    const template = encodeURIComponent(templateName);
    const props = encodeURIComponent('revisions');
    const rvprops = encodeURIComponent('content');
    const path = '?action=query&format=json'
    // Pages with template
    + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
    + `&prop=${props}`
    // Get content of page
    + `&rvprop=${rvprops}&rvslots=*`;
    yield* baseApi.continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
  }

  async function getArticleWithKipaTemplate(): Promise<WikiPage[]> {
    const template = encodeURIComponent('תבנית:כיפה');
    const props = encodeURIComponent('revisions');
    const rvprops = encodeURIComponent('content');
    const path = '?action=query&format=json'
    // Pages with כיפה'
    + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
    + `&prop=${props}`
    // Get content of page
    + `&rvprop=${rvprops}&rvslots=*`;
    let pages: WikiPage[] = [];
    let result = await request(path);
    const firstResult = Object.values(result.query.pages) satisfies WikiPage[];
    pages = firstResult;
    while (result.continue) {
      result = await request(`${path}&elcontinue=${result.continue.elcontinue}&rvcontinue=${result.continue.rvcontinue}&continue=${result.continue.continue}`);
      pages = pages.concat(Object.values(result.query.pages));
    }
    const finalResults = pages.filter((page) => page.revisions?.[0]?.slots.main['*'].includes('{{כיפה'));
    firstResult.forEach((page) => {
      if (!finalResults.find((p) => p.pageid === page.pageid)) {
        console.log(page.title);
      }
    });
    return finalResults;
  }

  async function getGoogleFinanceLinks(): Promise<Record<string, WikiPage>> {
    const template = encodeURIComponent('תבנית:מידע בורסאי (ארצות הברית)');
    const props = encodeURIComponent('extlinks');
    const googleFinanceLink = encodeURIComponent('www.google.com/finance?q=');
    const path = '?action=query&format=json'
    // Pages with תבנית:מידע בורסאי (ארצות הברית)'
    + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
    + `&prop=${props}`
    // Get google link
    + `&elprotocol=https&elquery=${googleFinanceLink}&ellimit=5000`;
    const result = await request(path);
    return result.query.pages;
  }

  async function updateArticle(
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

    return request('?action=edit&format=json&assert=bot&bot=true', 'post', objectToFormData(data));
  }

  async function getArticleContent(title: string): Promise<string | undefined> {
    const path = `?action=query&format=json&rvprop=content&rvslots=*&prop=revisions&titles=${
      encodeURIComponent(title)
    }`;
    const result = await request(path);
    const wikiPages:Record<string, Partial<WikiPage>> = result.query.pages;

    return Object.values(wikiPages)[0]?.revisions?.[0].slots.main['*'];
  }

  async function externalUrl(link:string, protocol:string = 'https') {
    const props = encodeURIComponent('revisions|extlinks');
    const rvprops = encodeURIComponent('content');
    const path = '?action=query&format=json&'
    + `generator=exturlusage&geuprotocol=${protocol}&geunamespace=0&geuquery=${encodeURIComponent(link)}&geulimit=500`
    + `&prop=${props}`
    + `&rvprop=${rvprops}&rvslots=*`;
    const result = await request(path);
    const res:Record<string, Partial<WikiPage>> = result.query?.pages ?? {};

    return Object.values(res);
  }

  async function* search(text:string) {
    const props = encodeURIComponent('revisions|extlinks');
    const rvprops = encodeURIComponent('content');

    const path = `?action=query&generator=search&format=json&gsrnamespace=0&gsrsearch=${encodeURIComponent(text)}&gsrlimit=500`
    + `&prop=${props}`
    + `&rvprop=${rvprops}&rvslots=*`;

    yield* baseApi.continueQuery(path);
  }

  async function* getRedirects(namespace = 0, linkNamespace = [0]) {
    const props = encodeURIComponent('links|templates|categories');
    const template = encodeURIComponent('תבנית:הפניה לא למחוק');
    const category = encodeURIComponent('קטגוריה:הפניות לא למחוק');
    const path = `?action=query&format=json&generator=allpages&gaplimit=500&gapfilterredir=redirects&gapnamespace=${namespace}`
    + `&prop=${props}&plnamespace=${encodeURIComponent(linkNamespace.join('|'))}&tltemplates=${template}&clcategories=${category}`;
    yield* baseApi.continueQuery(path);
  }

  async function info(titles:string[]) {
    if (titles.length > 500) {
      throw new Error('Too many titles');
    }
    const props = encodeURIComponent('protection');
    const encodedTitles = encodeURIComponent(titles.join('|'));
    const path = `?action=query&format=json&prop=info&inprop=${props}&titles=${encodedTitles}`;
    const result = await request(path);
    const res:Record<string, Partial<WikiPage>> = result.query?.pages;
    return Object.values(res);
  }

  async function purge(titles: string[]) {
    if (titles.length > 500) {
      throw new Error('Too many titles');
    }
    return request('?action=purge&format=json', 'post', objectToFormData({
      titles: titles.join('|'),
    }));
  }

  async function rollback(title: string, user: string, summary: string) {
    const { rollbacktoken } = await baseApi.getToken('rollback');
    const path = '?action=rollback&format=json';

    return request(path, 'post', objectToFormData({
      token: rollbacktoken,
      summary,
      user,
      title,
      markbot: true,
    }));
  }

  async function undo(title: string, summary: string, revision: number) {
    const path = '?action=edit&format=json';

    return request(path, 'post', objectToFormData({
      token,
      summary,
      title,
      undo: revision,
      bot: true,
    }));
  }

  async function* userContributes(user:string, limit = 500) {
    const props = encodeURIComponent('title|ids');
    const path = `?action=query&format=json&list=usercontribs&ucuser=${encodeURIComponent(user)}&uclimit=${limit}&ucprop=${props}`;
    yield* baseApi.continueQuery(path);
  }

  async function rollbackUserContributions(user:string, summary: string, count = 5) {
    if (count > 500) {
      throw new Error('Too many titles');
    }
    const { value } = await userContributes(user, count).next();
    const contributes = value.query.usercontribs;
    await promiseSequence(30, contributes.map((contribute) => async () => {
      await rollback(contribute.title, user, summary);
    }));
  }

  async function* listCategory(category: string, limit = 500) {
    const props = encodeURIComponent('title|sortkeyprefix');
    const path = `?action=query&format=json&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmlimit=${limit}&cmprop=${props}`;
    yield* baseApi.continueQuery(path);
  }

  async function categroyPages(category: string, limit = 500): Promise<WikiPage[]> {
    const rvprops = encodeURIComponent('content|size');
    const props = encodeURIComponent('title|sortkeyprefix');
    const path = `?action=query&format=json&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmlimit=${limit}&gcmprop=${props}`
    + `&prop=revisions&rvprop=${rvprops}&rvslots=*`;

    const pagesObject = await request(path);
    return Object.values(pagesObject?.query?.pages ?? []);
  }

  async function* categoriesStartsWith(prefix: string) {
    const path = `?action=query&format=json&list=allcategories&acprop=size&acprefix=${encodeURIComponent(prefix)}&aclimit=5000`;
    yield* baseApi.continueQuery(path);
  }

  async function undoContributions(user:string, summary: string, count = 5) {
    if (count > 500) {
      throw new Error('Too many titles');
    }
    const { value } = await userContributes(user, count).next();
    const contributes = value.query.usercontribs;
    await promiseSequence(30, contributes.map((contribute) => async () => {
      await undo(contribute.title, summary, contribute.revid);
    }));
  }

  async function* fileUsage(pageIds: string[], limit = 500) {
    const props = encodeURIComponent('title|ids');
    const pageIdsString = encodeURIComponent(pageIds.join('|'));
    const path = `?action=query&format=json&list=fileusage&fuprop=${props}&fulimit=${limit}&pageids=${pageIdsString}`;

    yield* baseApi.continueQuery(path);
  }

  async function protect(title:string, protections: string, expiry: string, reason: string) {
    return request('?action=protect&format=json&assert=bot', 'post', objectToFormData({
      title, token, expiry, reason, protections,
    }));
  }

  async function deletePage(title:string, reason: string) {
    const queryDetails = {
      method: 'post',
      data: objectToFormData({
        title, token, reason,
      }),
      url: '?action=delete&format=json&assert=bot',
    };
    return request(queryDetails.url, queryDetails.method, queryDetails.data);
  }

  return {
    getCompany,
    getCompanies,
    getMayaLinks,
    getGoogleFinanceLinksWithContent,
    getArticleWithKipaTemplate,
    getGoogleFinanceLinks,
    updateArticle,
    getArticleContent,
    externalUrl,
    info,
    purge,
    rollback,
    undo,
    rollbackUserContributions,
    categroyPages,
    undoContributions,
    protect,
    deletePage,
    getArticlesWithTemplate,
    search,
    getRedirects,
    userContributes,
    listCategory,
    categoriesStartsWith,
    fileUsage,
    getWikiDataItem,
  };
}
