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

export type EditResponse = {
  edit: {
    result: string;
    pageid: number;
    title: string;
    contentmodel: string;
    oldrevid?: number;
    newrevid?: number;
    newtimestamp?: string;
    nochange?: string;
  }
}

export type PageInfo = {
  missing?: string;
  invalid?: string;
  lastrevid?: number;
  length?: number;
  redirect?: string;
  ns?: number;
  pageid?: number;
  title?: string;
  invalidreason?: string;
  protection?: { type: string, level: string, expiry: string }[];
}

export type WikiPage = {
  pageid: number;
  ns: number;
  templates?: {
    ns: number;
    title: string;
  }[];
  missing?: string;
  revisions?: Revision[];
  lastrevid?: number;
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
  length?: number;
}
export type GlobalUsage = {
  title?: string;
  wiki?: string;
  url?: string;
};

export type FileWithGlobalUsage = WikiPage & {
  globalusage?: GlobalUsage[];
};
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
  sizediff: number;
}

export type RecentChange = {
  type: 'edit' | 'new' | 'log' | 'categorize' | 'external';
  ns: number;
  title: string;
  oldlen: number;
  newlen: number;
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

export type WikiDataSnack = {
  snaktype: string;
  property: string;
  datatype: string;
  hash?: string;
  datavalue: {
    value: any;
    type: string;
  }
}

export type WikiDataReference = {
  hash?: string;
  snaks: Record<string, WikiDataSnack[]>;
  'snaks-order': string[];
}

export type WikiDataClaim = {
  mainsnak: {
    snaktype: string;
    property: string;
    datavalue: {
      value: any;
      type: string;
    }
  };
  qualifiers?: Record<string, WikiDataSnack[]>;
  'qualifiers-order': string[];
  type: string;
  id: string;
  rank: string;
  references?: WikiDataReference[];
}

export type WikiDataEntity = {
  type: string;
  id: string;
  labels?: Record<string, { language: string, value: string }>;
  descriptions?: Record<string, { language: string, value: string }>;
  aliases?: Record<string, { language: string, value: string }[]>;
  claims?: Record<string, WikiDataClaim[]>;
  sitelinks?: Record<string, { site: string, title: string }>;
}

export type WikiDataSetClaimResponse = {
  success: 1 | 0;
  id: string;
  type: string;
  claim: WikiDataClaim;
  pageinfo: {
    lastrevid: number;
  },
}

export type WikiDataSetReferenceResponse = {
  success: 1 | 0;
  pageinfo: {
    lastrevid: number;
  },
  reference: WikiDataReference
}

export type WikiRedirectData = {
  from: string;
  to: string;
  tofragment?: string;
  tosection?: string;
}

export type WikiNotification = {
  wiki: string;
  id: number;
  type: string;
  category: string;
  section: string;
  timestamp: {
    utciso8601: string;
    utcunix: number;
    unix: number;
    utcmw: string;
    mw: string;
    date: string;
  };
  agent: {
    id: number;
    name: string;
  };
  title: {
    full: string;
    namespace: string;
    'namespace-key': number;
    text: string;
  };
  revid: number;
  targetpages: string[];
  '*': {
    header: string;
    compactHeader: string;
    body: string;
    icon: string;
    links: {
      primary: {
        url: string;
        label: string;
      };
      secondary: {
        url: string;
        label: string;
        tooltip: string;
        description: string;
        icon: string;
        prioritized: string;
      }[];
    };
    iconUrl: string;
  };
}

export type FlowGender = 'male' | 'female' | 'unknown';

export type FlowUserLink = {
  url: string;
  title: string;
  exists: boolean;
};

export type FlowUserLinks = {
  contribs: FlowUserLink;
  userpage: FlowUserLink;
  talk: FlowUserLink;
};

export type FlowUser = {
  name: string;
  wiki: string;
  gender: FlowGender;
  links: FlowUserLinks;
  id: number;
};

export type FlowLastEditUser = {
  name: string | null;
  wiki: string | null;
  gender: FlowGender;
  links: FlowUserLinks | [];
  id: number | null;
};

export type FlowLink = {
  url: string;
  title: string;
  text: string;
};

export type FlowTopicProperties = {
  'topic-of-post': {
    plaintext: string;
  };
  'topic-of-post-text-from-html': {
    plaintext: string;
  };
};

export type FlowRevisionLinks = {
  'topic-history': FlowLink;
  topic: FlowLink;
  post: FlowLink;

  'topic-revision'?: FlowLink;
  'post-revision'?: FlowLink;
  'post-history'?: FlowLink;

  diff?: FlowLink;
  'diff-prev'?: FlowLink;

  'watch-topic'?: FlowLink;
  'unwatch-topic'?: FlowLink;
};

export type FlowRevisionBase = {
  workflowId: string;
  articleTitle: string;
  revisionId: string;

  timestamp: string;
  dateFormats: unknown[];

  isOriginalContent: boolean;
  isModerated: boolean;

  actions: unknown[];

  size: {
    old: string;
    new: string;
  };

  author: FlowUser;
  creator: FlowUser;
  lastEditUser: FlowLastEditUser;

  lastEditId: string | null;
  previousRevisionId: string | null;

  isLocked: boolean;
  isModeratedNotLocked: boolean;

  isWatched: boolean;
  watchable: boolean;

  postId: string;
  isMaxThreadingDepth: boolean;
  isNewPage: boolean;

  replies: string[];
};

export type FlowNewTopicRevision = FlowRevisionBase & {
  changeType: 'new-post';

  properties: FlowTopicProperties;

  links: FlowRevisionLinks & {
    'topic-revision': FlowLink;
  };

  content: {
    content: string;
    format: 'topic-title-html';
    plaintext: string;
  };

  replyToId: null;

  reply_count: number;
  last_updated_readable: string;
  last_updated: number;
};

export type FlowReplyRevision = FlowRevisionBase & {
  changeType: 'reply';

  properties: [];

  links: FlowRevisionLinks & {
    'post-revision': FlowLink;
  };

  content: {
    content: string;
    format: string;
  };

  replyToId: string;

  reply_count?: never;
  last_updated_readable?: never;
  last_updated?: never;
};

export type FlowEditPostRevision = FlowRevisionBase & {
  changeType: 'edit-post';

  properties: [];

  links: FlowRevisionLinks & {
    'post-history': FlowLink;
    'post-revision': FlowLink;
    diff: FlowLink;
    'diff-prev': FlowLink;
  };

  content: {
    content: string;
    format: 'fixed-html';
  };

  replyToId: string;

  reply_count?: never;
  last_updated_readable?: never;
  last_updated?: never;
};

export type FlowModerationReason = {
  content: string;
  format: 'plaintext';
};

export type FlowLockTopicRevision = FlowRevisionBase & {
  changeType: 'lock-topic';

  properties: FlowTopicProperties;

  links: Omit<FlowRevisionLinks, 'post'> & {
    'topic-revision': FlowLink;
  };

  moderator: FlowUser;
  moderateState: 'lock';
  moderateReason: FlowModerationReason;

  content: {
    content: string;
    format: 'topic-title-wikitext';
    plaintext: string;
  };

  replyToId: null;

  reply_count: number;
  last_updated: number;
};

export type FlowRevision =
  | FlowNewTopicRevision
  | FlowReplyRevision
  | FlowEditPostRevision
  | FlowLockTopicRevision;

export type FlowTopicAction = {
  url: FlowLink;
};

export type FlowTopic = {
  type: 'topic';

  roots: string[];

  /**
   * The key is a post or topic ID.
   * The value contains the associated revision IDs.
   */
  posts: Record<string, string[]>;

  /**
   * The key is a revision ID.
   */
  revisions: Record<string, FlowRevision>;

  workflowId: string;

  links: unknown[];

  actions: {
    newtopic: FlowTopicAction;
  };

  submitted: {
    format: 'wikitext';
  };

  errors: unknown[];
};

export type FlowTopicResponse = {
  flow: {
    'view-topic': {
      result: {
        topic: FlowTopic;
      };
      status: 'ok';
    };
  };
};

export type FlowTopicList = {
  submitted: {
    'offset-dir': string;
    sortby: string;
    'offset-id': string | null;
    offset: string | null;
    limit: number;
    format: string;
  };

  errors: unknown[];
  sortby: string;
  roots: string[];

  /**
   * The key is a post or topic ID.
   * The value contains the associated revision IDs.
   */
  posts: Record<string, string[]>;

  /**
   * The key is a revision ID.
   */
  revisions: Record<string, FlowRevision>;

  workflowId: string;
  title: string;

  actions: {
    newtopic: FlowLink;
  };

  links: {
    'board-sort': {
      updated: string;
      newest: string;
    };
    newtopic: string;
    pagination: {
      fwd?: FlowLink;
      rev?: FlowLink;
    };
  };

  type: 'topiclist';
};

export type FlowTopicListResponse = {
  flow: {
    'view-topiclist': {
      result: {
        topiclist: FlowTopicList;
      };
      status: 'ok';
    };
  };
};
