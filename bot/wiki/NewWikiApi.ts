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

  function login() {
    return tokenPromise;
  }

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

  async function* getArticlesWithTemplate(
    templateName: string,
    continueObject?: Record<string, string>,
    prefix = 'תבנית',
    namespace = '0',
  ): AsyncGenerator<WikiPage[], void, WikiPage[]> {
    const template = encodeURIComponent(`${prefix ? `${prefix}:` : ''}${templateName}`);
    const props = encodeURIComponent('revisions');
    const rvprops = encodeURIComponent('content');
    const path = '?action=query&format=json'
    // Pages with template
    + `&generator=embeddedin&geinamespace=${namespace}&geilimit=50&geititle=${template}`
    + `&prop=${props}`
    // Get content of page
    + `&rvprop=${rvprops}&rvslots=*`;
    yield* baseApi.continueQuery(
      path,
      (result) => Object.values(result?.query?.pages ?? {}),
      continueObject,
    );
  }

  async function* backlinksTo(target: string, namespace = '0') {
    const path = `?action=query&format=json&generator=backlinks&gblnamespace=${namespace}&gbltitle=${encodeURIComponent(target)}&gbllimit=500`
    + '&gblfilterredir=nonredirects&prop=revisions&rvprop=content&rvslots=*';
    yield* baseApi.continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
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

  async function* externalUrl(link:string, protocol:string = 'https') {
    const props = encodeURIComponent('revisions');
    const rvprops = encodeURIComponent('content');
    const path = '?action=query&format=json&'
    + `generator=exturlusage&geuprotocol=${protocol}&geunamespace=0&geuquery=${encodeURIComponent(link)}&geulimit=100`
    + `&prop=${props}`
    + `&rvprop=${rvprops}&rvslots=*`;
    yield* baseApi.continueQuery(
      path,
      (result) => Object.values(result?.query?.pages ?? {}),
    );
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

  async function* listCategory(category: string, limit = 500, type = 'page|subcat|file') {
    const props = encodeURIComponent('title|sortkeyprefix');
    const path = `?action=query&format=json&list=categorymembers&cmtype=${encodeURIComponent(type)}&cmtitle=Category:${encodeURIComponent(category)}&cmlimit=${limit}&cmprop=${props}`;
    yield* baseApi.continueQuery(path, (result) => Object.values(
      result?.query?.categorymembers ?? {},
    ));
  }

  async function* recursiveSubCategories(category: string, limit = 500) {
    const generator = listCategory(category, limit, 'subcat');

    for await (const subCategory of generator) {
      for (const page of subCategory) {
        yield page;
        yield* recursiveSubCategories(page.title, limit);
      }
    }
  }

  async function* categroyPages(category: string, limit = 50) {
    const rvprops = encodeURIComponent('content|size');
    const props = encodeURIComponent('title|sortkeyprefix');
    const path = `?action=query&format=json&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmlimit=${limit}&gcmprop=${props}`
    + `&prop=revisions&rvprop=${rvprops}&rvslots=*`;

    yield* baseApi.continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
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
    login,
    request: baseApi.request,
    recursiveSubCategories,
    backlinksTo,
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
