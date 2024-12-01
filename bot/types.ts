export type Revision = {
  user: string;
  size: number;
  comment?: string;
  revid?: number;
  timestamp?: string;
  slots: {
    main: {
      contentmodel: string;
      contentformat: string;
      '*': string;
    }
  }
};

export type WikiPage = {
  pageid: number;
  ns: number;
  templates?: {
    ns: number;
    title: string;
  }[];
  missing?: string;
  revisions?: Revision[];
  extlinks: {
    '*': string;
  }[];
  protection?: { type: string, level: string, expiry: string }[];
  links?: { ns: number, title: string }[];
  title: string;
  pageprops?: {
    wikibase_item: string;
  };
  redirect?: string;
  categories?: {
    ns: number;
    title: string;
  }[];
  sortkeyprefix?: string;
}
export interface WikiApiConfig {
  baseUrl: string;
  userName: string;
  password: string;
  assertBot?: boolean;
}

export type UserContribution = {
  userid: number;
  user: string;
  pageid: number;
  revid: number;
  parentid: number;
  ns: number;
  title: string;
  comment: string;
}

export type IBaseWikiApi = {
  login: () => Promise<string>;
  request: (path: string, method?: string, data?: Record<string, any>) => Promise<any>;
  continueQuery: (
    path: string,
    resultConverterCallback?: ((result: any) => any),
    baseContinue?: Record<string, any>
  ) => AsyncGenerator<any, any, void>;
  getToken: (tokenType?: string) => Promise<Record<string, string>>;

}

export type LogEvent = {
  ns: number;
  pageid: number;
  logpage: number;
  revid: number;
  action: string;
  logid?: number;
  title?: string;
  params?: {
    target_ns?: number;
    target_title?: string;
  };
  type?: string;
  user?: string;
  timestamp?: string;
  comment?: string;
}
