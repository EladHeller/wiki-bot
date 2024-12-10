import {
  LogEvent,
  Revision, UserContribution, WikiPage,
} from '../types';
import { objectToFormData, promiseSequence } from '../utilities';
import BaseWikiApi, { defaultConfig } from './BaseWikiApi';

export interface IWikiApi {
  login(): Promise<void>;
  request(path: string, method?: string, data?: Record<string, any>): Promise<any>;
  continueQuery(path: string, resultSelector?: (result: any) => any[], continueObject?: Record<string, string>):
    AsyncGenerator<any, void, void>;
  recursiveSubCategories(category: string, limit?: number): AsyncGenerator<WikiPage, WikiPage, void>;
  backlinksTo(target: string, namespace?: string): AsyncGenerator<WikiPage[], void, void>;
  /**
   * @deprecated Use edit api instead
   */
  updateArticle(articleTitle: string, summary: string, content: string, newSectionTitle?: string): Promise<any>;
  edit(
    articleTitle: string, summary: string, content: string, baseRevId: number, newSectionTitle?: string
  ): Promise<any>;
  create(
    articleTitle: string, summary: string, content: string
  ): Promise<any>;
  articleContent(title: string): Promise<{content: string, revid: number} | null>;
  externalUrl(link: string, protocol?: string, namespace?: string): AsyncGenerator<WikiPage[], void, void>;
  info(titles: string[]): Promise<Partial<WikiPage>[]>;
  purge(titles: string[]): Promise<any>;
  rollback(title: string, user: string, summary: string): Promise<any>;
  undo(title: string, summary: string, revision: number): Promise<any>;
  rollbackUserContributions(user: string, summary: string, count?: number): Promise<any>;
  categroyPages(category: string, limit?: number): AsyncGenerator<WikiPage[], void, void>;
  categroyTitles(category: string, limit?: number): AsyncGenerator<WikiPage[], void, void>;
  undoContributions(user: string, summary: string, count?: number): Promise<any>;
  protect(title: string, protections: string, expiry: string, reason: string): Promise<any>;
  deletePage(title: string, reason: string): Promise<any>;
  getArticlesWithTemplate(
    templateName: string, continueObject?: Record<string, string>, prefix?: string, namespace?: string
  ): AsyncGenerator<WikiPage[], void, void>;
  search(text: string): AsyncGenerator<WikiPage[], void, void>;
  getRedirects(namespace?: number, linkNamespace?: number[], limit?: number, templates?: string, categories?: string):
    AsyncGenerator<WikiPage[], void, void>;
  userContributes(user: string, limit?: number): AsyncGenerator<UserContribution[], void, void>;
  listCategory(category: string, limit?: number, type?: string): AsyncGenerator<WikiPage[], void, void>;
  categoriesStartsWith(prefix: string): AsyncGenerator<WikiPage[], void, void>;
  fileUsage(pageIds: string[], limit?: number): AsyncGenerator<WikiPage[], void, void>;
  getWikiDataItem(title: string): Promise<string | undefined>;
  newPages(namespaces: number[], endTimestamp: string, limit?: number): AsyncGenerator<WikiPage[], void, void>;
  getArticleRevisions(title: string, limit: number): Promise<Revision[]>;
  logs(
    type: string, namespaces: number[], endTimestamp: string, limit?: number
  ): AsyncGenerator<LogEvent[], void, void>;
  movePage(from: string, to: string, reason: string): Promise<void>;
}

export default function NewWikiApi(baseWikiApi = BaseWikiApi(defaultConfig)): IWikiApi {
  let token: string;

  async function init() {
    token = await baseWikiApi.login();
  }
  const tokenPromise = init();

  function login() {
    return tokenPromise;
  }

  async function request(path: string, method?: string, data?: Record<string, any>): Promise<any> {
    await tokenPromise;
    return baseWikiApi.request(path, method, data);
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
  ): AsyncGenerator<WikiPage[], void, void> {
    const template = encodeURIComponent(`${prefix ? `${prefix}:` : ''}${templateName}`);
    const props = encodeURIComponent('revisions');
    const rvprops = encodeURIComponent('content|ids');
    const path = '?action=query&format=json'
    // Pages with template
    + `&generator=embeddedin&geinamespace=${namespace}&geilimit=50&geititle=${template}`
    + `&prop=${props}`
    // Get content of page
    + `&rvprop=${rvprops}&rvslots=*`;
    yield* baseWikiApi.continueQuery(
      path,
      (result) => Object.values(result?.query?.pages ?? {}),
      continueObject,
    );
  }

  async function* backlinksTo(target: string, namespace = '0') {
    const path = `?action=query&format=json&generator=backlinks&gblnamespace=${namespace}&gbltitle=${encodeURIComponent(target)}&gbllimit=500`
    + '&gblfilterredir=nonredirects&prop=revisions&rvprop=content&rvslots=*';
    yield* baseWikiApi.continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
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

  async function edit(
    articleTitle: string,
    summary: string,
    content: string,
    baseRevId: number,
    newSectionTitle?: string,
  ) {
    const data: Record<string, string> = {
      title: articleTitle, text: content, token, summary, baserevid: baseRevId.toString(),
    };
    if (newSectionTitle) {
      data.sectiontitle = newSectionTitle;
      data.section = 'new';
    }

    return request('?action=edit&format=json&assert=bot&bot=true', 'post', objectToFormData(data));
  }

  async function create(
    articleTitle: string,
    summary: string,
    content: string,
  ) {
    const data: Record<string, string> = {
      title: articleTitle, text: content, token, summary, createonly: 'true',
    };

    return request('?action=edit&format=json&assert=bot&bot=true', 'post', objectToFormData(data));
  }

  async function articleContent(title: string): Promise<{content: string, revid: number} | null> {
    const props = encodeURIComponent('content|ids');
    const path = `?action=query&format=json&rvprop=${props}&rvslots=*&prop=revisions&titles=${
      encodeURIComponent(title)
    }`;
    const result = await request(path);
    const wikiPages:Record<string, Partial<WikiPage>> = result.query.pages;

    const revision = Object.values(wikiPages)[0]?.revisions?.[0];
    if (!revision?.revid) {
      return null;
    }

    return {
      content: revision.slots.main['*'],
      revid: revision.revid,
    };
  }

  async function getArticleRevisions(title: string, limit: number) {
    const props = encodeURIComponent('content|user|size|comment');
    const path = `?action=query&format=json&rvprop=${props}&rvslots=*&prop=revisions&titles=${
      encodeURIComponent(title)
    }&rvlimit=${limit}`;
    const result = await request(path);
    const wikiPages:Record<string, Partial<WikiPage>> = result.query.pages;

    return Object.values(wikiPages)[0]?.revisions ?? [];
  }

  async function* externalUrl(link:string, protocol:string = 'https', namespace = '0') {
    const props = encodeURIComponent('revisions');
    const rvprops = encodeURIComponent('content|ids');
    const path = '?action=query&format=json&'
    + `generator=exturlusage&geuprotocol=${protocol}&geunamespace=${encodeURIComponent(namespace)}&geuquery=${encodeURIComponent(link)}&geulimit=100`
    + `&prop=${props}`
    + `&rvprop=${rvprops}&rvslots=*`;
    yield* baseWikiApi.continueQuery(
      path,
      (result) => Object.values(result?.query?.pages ?? {}),
    );
  }

  async function* search(text:string) {
    const props = encodeURIComponent('revisions');
    const rvprops = encodeURIComponent('content|ids');

    const path = `?action=query&generator=search&format=json&gsrnamespace=0&gsrsearch=${encodeURIComponent(text)}&gsrlimit=50`
    + `&prop=${props}`
    + `&rvprop=${rvprops}&rvslots=*`;

    yield* baseWikiApi.continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
  }

  async function* getRedirects(namespace: number, linkNamespace: number[], limit = 100, templates = '', categories = '') {
    const props = encodeURIComponent('links|templates|categories');
    const template = encodeURIComponent(templates);
    const templateString = template ? `&tltemplates=${template}&tllimit=${limit}` : '';
    const category = encodeURIComponent(categories);
    const categoryString = category ? `&clcategories=${category}&cllimit=${limit}` : '';
    const path = `?action=query&format=json&generator=allredirects&garlimit=${limit}&garnamespace=${namespace}&gardir=ascending`
    + `&prop=${props}&plnamespace=${encodeURIComponent(linkNamespace.join('|'))}${templateString}${categoryString}&pllimit=${limit}`;
    yield* baseWikiApi.continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
  }

  async function info(titles:string[]) {
    if (titles.length > 500) {
      throw new Error('Too many titles');
    }
    const props = encodeURIComponent('protection');
    const encodedTitles = encodeURIComponent(titles.join('|'));
    const path = `?action=query&format=json&prop=info&inprop=${props}&titles=${encodedTitles}`;
    const result = await request(path);
    const res:Record<string, Partial<WikiPage>> = result.query?.pages ?? {};
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
    const { rollbacktoken } = await baseWikiApi.getToken('rollback');
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
    const props = encodeURIComponent('title|ids|comment');
    const path = `?action=query&format=json&list=usercontribs&ucuser=${encodeURIComponent(user)}&uclimit=${limit}&ucprop=${props}`;
    yield* baseWikiApi.continueQuery(path, (result) => Object.values(result?.query?.usercontribs ?? {}));
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
    yield* baseWikiApi.continueQuery(path, (result) => Object.values(
      result?.query?.categorymembers ?? {},
    ));
  }

  async function* recursiveSubCategories(category: string, limit = 500) {
    const generator = listCategory(category, limit, 'subcat');

    for await (const subCategory of generator) {
      for (const page of subCategory) {
        yield page;
        yield* recursiveSubCategories(page.title.replace('קטגוריה:', ''), limit);
      }
    }
  }

  async function* categroyPages(category: string, limit = 50) {
    const rvprops = encodeURIComponent('content|size|ids');
    const props = encodeURIComponent('title|sortkeyprefix');
    const path = `?action=query&format=json&generator=categorymembers&gcmtitle=Category:${encodeURIComponent(category)}&gcmlimit=${limit}&gcmprop=${props}`
      + `&prop=revisions&rvprop=${rvprops}&rvslots=*`;

    yield* baseWikiApi.continueQuery(path, (result) => Object.values(result?.query?.pages ?? {}));
  }

  async function* categroyTitles(category: string, limit = 50) {
    const props = encodeURIComponent('title|sortkeyprefix');
    const path = `?action=query&format=json&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmlimit=${limit}&cmprop=${props}`;

    yield* baseWikiApi.continueQuery(path, (result) => Object.values(result?.query?.categorymembers ?? {}));
  }

  async function* categoriesStartsWith(prefix: string) {
    const path = `?action=query&format=json&list=allcategories&acprop=size&acprefix=${encodeURIComponent(prefix)}&aclimit=5000`;
    yield* baseWikiApi.continueQuery(path, (result) => Object.values(result?.query?.allcategories ?? {}));
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

    yield* baseWikiApi.continueQuery(path);
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

  async function* newPages(namespaces: number[], endTimestamp: string, limit = 500) {
    const path = `?action=query&format=json&list=recentchanges&rcprop=title&rcnamespace=${namespaces.join('|')}&rctype=new&rcshow=!redirect|!bot&rclimit=${limit}&rcend=${endTimestamp}`;
    yield* baseWikiApi.continueQuery(path, (result) => Object.values(
      result?.query?.recentchanges ?? {},
    ));
  }

  async function* logs(type: string, namespaces: number[], endTimestamp: string, limit = 100) {
    for (const namespace of namespaces) {
      const path = `?action=query&format=json&list=logevents&letype=${encodeURIComponent(type)}&lenamespace=${namespace}&leend=${endTimestamp}&lelimit=${limit}`;
      yield* baseWikiApi.continueQuery(path, (result) => Object.values(
        result?.query?.logevents ?? {},
      ));
    }
  }

  async function movePage(from: string, to: string, reason: string) {
    return request('?action=move&format=json&movetalk=true', 'post', objectToFormData({
      from, to, token, reason,
    }));
  }

  return {
    login,
    request: baseWikiApi.request,
    continueQuery: baseWikiApi.continueQuery,
    recursiveSubCategories,
    backlinksTo,
    updateArticle,
    articleContent,
    externalUrl,
    categroyTitles,
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
    getArticleRevisions,
    newPages,
    logs,
    movePage,
    edit,
    create,
  };
}
