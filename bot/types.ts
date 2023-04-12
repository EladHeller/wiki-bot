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
    links?: {ns: number, title: string}[];
    title: string;
    pageprops?: {
      wikibase_item: string;
    }
  }
