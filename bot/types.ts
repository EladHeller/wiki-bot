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
    }[];
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

export interface WikidataClaim {
  entity: string;
  property: string;
  value: string;
  summary: string;
}
// {"id":"Q4115189$5627445f-43cb-ed6d-3adb-760e85bd17ee","type":"claim","mainsnak":{"snaktype":"value","property":"P1","datavalue":{"value":"City","type":"string"}}} [open in sandbox]
