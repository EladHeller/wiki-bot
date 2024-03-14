export type Revision = {
  user: string;
  size: number;
  comment?: string;
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
    revisions: Revision[];
    extlinks: {
      '*': string;
    }[];
    protection?: {type: string, level: string, expiry: string}[];
    links?: {ns: number, title: string}[];
    title: string;
    pageprops?: {
      wikibase_item: string;
    };
    categories?: {
      ns: number;
      title: string;
    }[];
}
export interface WikiApiConfig {
    baseUrl: string;
    userName: string;
    password: string;
    assertBot?: boolean;
}

export type UserContribution = {
  // userid: 313102,
  // user: 'Sapper-bot',
  // pageid: 1426492,
  // revid: 38017533,
  // parentid: 20071400,
  // ns: 10,
  // title: 'תבנית:ציטוט יומי 6 בינואר 2017'
  userid: number;
  user: string;
  pageid: number;
  revid: number;
  parentid: number;
  ns: number;
  title: string;
  comment: string;
}
