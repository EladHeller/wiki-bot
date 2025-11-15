import { createGunzip } from 'zlib';
import { createWriteStream, createReadStream, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { createInterface } from 'readline';

const CATEGORY_NS = 14 as const;
const USER_NS = 2 as const;
const DRAFT_NS = 118 as const;

type NS = typeof CATEGORY_NS | typeof USER_NS | typeof DRAFT_NS | number;

const cfg = {
  ns2Label: process.env.NS2_LABEL ?? 'משתמש',
  ns118Label: process.env.NS118_LABEL ?? 'טיוטה',
  rootTitle: process.env.ROOT_CATEGORY_TITLE ?? 'קטגוריות',
  pageDumpUrl:
    process.env.PAGE_DUMP_URL
    ?? 'https://dumps.wikimedia.org/hewiki/latest/hewiki-latest-page.sql.gz',
  categorylinksDumpUrl:
    process.env.CATEGORYLINKS_DUMP_URL
    ?? 'https://dumps.wikimedia.org/hewiki/latest/hewiki-latest-categorylinks.sql.gz',
  linktargetDumpUrl:
    process.env.LINKTARGET_DUMP_URL
    ?? 'https://dumps.wikimedia.org/hewiki/latest/hewiki-latest-linktarget.sql.gz',
};

type Title = string;
type LtId = number;
type PageId = number;

type TitleToLt = Map<Title, LtId>;
type PageNSMap = Map<PageId, NS>;
type PageTitleMap = Map<PageId, Title>;
type ChildrenMap = Map<LtId, LtId[]>;

function getTempPath(url: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
  const filename = `dump-${hash}.sql`;
  return join('/tmp', filename);
}

async function downloadAndDecompress(url: string): Promise<string> {
  const tempPath = getTempPath(url);

  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }

  mkdirSync('/tmp', { recursive: true });

  const reader = response.body.getReader();
  const gunzip = createGunzip();
  const writeStream = createWriteStream(tempPath);

  gunzip.pipe(writeStream);

  const writeFinished = new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const gunzipError = new Promise<void>((resolve, reject) => {
    gunzip.on('error', reject);
    gunzip.on('end', resolve);
  });

  const readAndWrite = async () => {
    let readerDone = false;
    while (!readerDone) {
      const result = await reader.read();
      readerDone = result.done;
      if (!readerDone && result.value) {
        gunzip.write(Buffer.from(result.value));
      }
    }
    gunzip.end();
  };

  await readAndWrite();
  await Promise.all([gunzipError, writeFinished]);

  console.log(`Decompressed to ${tempPath}`);
  return tempPath;
}

function parseField(value: string): any {
  if (value === 'NULL') {
    return null;
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }
  if (!Number.isNaN(Number(value)) && value !== '') {
    return Number(value);
  }
  return value;
}

async function* parseSqlFile(filePath: string): AsyncGenerator<any[]> {
  const fileStream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let buffer = '';
  let rowCount = 0;
  let inInsert = false;

  for await (const line of rl) {
    buffer += line;

    if (!inInsert && buffer.includes('INSERT INTO')) {
      inInsert = true;
    }

    if (inInsert && buffer.includes(';')) {
      // Extract the INSERT statement
      const insertMatch = /INSERT\s+INTO\s+`[^`]+`\s+VALUES\s+(.+?);/is.exec(buffer);

      if (insertMatch) {
        const valuesSection = insertMatch[1];

        const rowRegex = /\(([^)]+(?:\([^)]*\)[^)]*)*)\)/g;
        const matches = Array.from(valuesSection.matchAll(rowRegex));

        for (const rowMatch of matches) {
          const rowText = rowMatch[1];
          const fields: any[] = [];

          let field = '';
          let inString = false;
          let escapeNext = false;

          for (let i = 0; i < rowText.length; i += 1) {
            const char = rowText[i];

            if (escapeNext) {
              field += char;
              escapeNext = false;
            } else if (char === '\\') {
              escapeNext = true;
            } else if (char === "'" && !escapeNext) {
              inString = !inString;
              field += char;
            } else if (char === ',' && !inString) {
              fields.push(parseField(field.trim()));
              field = '';
            } else {
              field += char;
            }
          }

          if (field) {
            fields.push(parseField(field.trim()));
          }

          if (fields.length > 0) {
            rowCount += 1;
            yield fields;
          }
        }
      }

      buffer = '';
      inInsert = false;
    }
  }

  console.log(`Parsed ${rowCount} total rows from file`);
}

const setPush = <T>(m: Map<T, T[]>, k: T, v: T): Map<T, T[]> => {
  const prev = m.get(k);
  if (prev) prev.push(v);
  else m.set(k, [v]);
  return m;
};

const bfs = (root: LtId, children: ChildrenMap): Set<LtId> => {
  const seen = new Set<LtId>([root]);
  const q: LtId[] = [root];
  while (q.length) {
    const cur = q.shift()!;
    const kids = children.get(cur) ?? [];
    for (const ch of kids) {
      if (!seen.has(ch)) {
        seen.add(ch);
        q.push(ch);
      }
    }
  }
  return seen;
};

const formatTitle = (ns: NS, title: Title): string => {
  if (ns === USER_NS) return `${cfg.ns2Label}:${title}`;
  if (ns === DRAFT_NS) return `${cfg.ns118Label}:${title}`;
  return title;
};

async function downloadAndParseLinktarget(): Promise<{
  titleToLt: TitleToLt;
  rootLt: LtId;
}> {
  console.log('Downloading linktarget.sql.gz');
  const filePath = await downloadAndDecompress(cfg.linktargetDumpUrl);
  console.log('Parsing linktarget.sql');
  const titleToLt: TitleToLt = new Map();
  let categoryCount = 0;

  for await (const row of parseSqlFile(filePath)) {
    if (row.length >= 3) {
      const ltId = row[0] as number;
      const ltNamespace = row[1] as number;
      const ltTitle = row[2] as string;

      if (ltNamespace === CATEGORY_NS && ltTitle) {
        categoryCount += 1;
        titleToLt.set(ltTitle, ltId);
      }
    }
  }

  console.log(`Found ${categoryCount} categories`);

  const rootLt = titleToLt.get(cfg.rootTitle);
  if (!rootLt) {
    throw new Error(
      `Root category "${cfg.rootTitle}" not found in linktarget (ns=14). Found ${titleToLt.size} categories.`,
    );
  }

  return { titleToLt, rootLt };
}

async function downloadAndParsePage(): Promise<{
  pageNS: PageNSMap;
  userDraftTitles: PageTitleMap;
  catTitles: PageTitleMap;
}> {
  console.log('Downloading page.sql.gz');
  const filePath = await downloadAndDecompress(cfg.pageDumpUrl);
  console.log('Parsing page.sql');
  const pageNS: PageNSMap = new Map();
  const userDraftTitles: PageTitleMap = new Map();
  const catTitles: PageTitleMap = new Map();

  for await (const row of parseSqlFile(filePath)) {
    if (row.length >= 3) {
      const pageId = row[0] as number;
      const pageNamespace = row[1] as number;
      const pageTitle = row[2] as string | null;

      if (pageId && pageNamespace !== undefined) {
        pageNS.set(pageId, pageNamespace);

        if (pageTitle) {
          if (pageNamespace === USER_NS || pageNamespace === DRAFT_NS) {
            userDraftTitles.set(pageId, pageTitle);
          } else if (pageNamespace === CATEGORY_NS) {
            catTitles.set(pageId, pageTitle);
          }
        }
      }
    }
  }

  return { pageNS, userDraftTitles, catTitles };
}

const processCategorylinkRow = (
  row: any[],
  pageNS: PageNSMap,
  catTitles: PageTitleMap,
  titleToLt: TitleToLt,
  children: ChildrenMap,
  pageMemberships: Array<{ pageId: PageId; catLt: LtId }>,
): void => {
  if (row.length < 7) return;

  const clFrom = row[0] as number;
  const clType = row[4] as string;
  const clTargetId = row[6] as number | null;

  if (!clFrom || !clType || !clTargetId) return;

  if (clType === 'page') {
    pageMemberships.push({ pageId: clFrom, catLt: clTargetId });
    return;
  }

  if (clType !== 'subcat') return;
  if (pageNS.get(clFrom) !== CATEGORY_NS) return;

  const childTitle = catTitles.get(clFrom);
  if (!childTitle) return;

  const childLt = titleToLt.get(childTitle);
  if (!childLt) return;

  setPush(children, clTargetId, childLt);
};

async function downloadAndParseCategorylinks(
  pageNS: PageNSMap,
  catTitles: PageTitleMap,
  titleToLt: TitleToLt,
): Promise<{
  children: ChildrenMap;
  pageMemberships: Array<{ pageId: PageId; catLt: LtId }>;
}> {
  console.log('Downloading categorylinks.sql.gz');
  const filePath = await downloadAndDecompress(cfg.categorylinksDumpUrl);
  console.log('Parsing categorylinks.sql');

  const children: ChildrenMap = new Map();
  const pageMemberships: Array<{ pageId: PageId; catLt: LtId }> = [];

  for await (const row of parseSqlFile(filePath)) {
    processCategorylinkRow(row, pageNS, catTitles, titleToLt, children, pageMemberships);
  }

  return { children, pageMemberships };
}

function collectUserDraftMembers(
  reachable: Set<LtId>,
  pageNS: PageNSMap,
  userDraftTitles: PageTitleMap,
  pageMemberships: Array<{ pageId: PageId; catLt: LtId }>,
): string[] {
  const result: string[] = [];
  const printed = new Set<PageId>();

  for (const { pageId, catLt } of pageMemberships) {
    if (
      reachable.has(catLt)
      && !printed.has(pageId)
    ) {
      const ns = pageNS.get(pageId);
      if (ns === USER_NS || ns === DRAFT_NS) {
        const title = userDraftTitles.get(pageId);
        if (title) {
          printed.add(pageId);
          result.push(formatTitle(ns, title));
        }
      }
    }
  }

  return result;
}

export async function getDumpModificationTimes(): Promise<{
  page: Date;
  categorylinks: Date;
  linktarget: Date;
}> {
  const fetchLastModified = async (url: string): Promise<Date> => {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`Failed to fetch headers for ${url}: ${response.status}`);
    }
    const lastModified = response.headers.get('Last-Modified');
    if (!lastModified) {
      throw new Error(`No Last-Modified header for ${url}`);
    }
    return new Date(lastModified);
  };

  const [page, categorylinks, linktarget] = await Promise.all([
    fetchLastModified(cfg.pageDumpUrl),
    fetchLastModified(cfg.categorylinksDumpUrl),
    fetchLastModified(cfg.linktargetDumpUrl),
  ]);

  return { page, categorylinks, linktarget };
}

export default async function main(): Promise<string[]> {
  const [{ titleToLt, rootLt }, { pageNS, userDraftTitles, catTitles }] = await Promise.all([
    downloadAndParseLinktarget(),
    downloadAndParsePage(),
  ]);

  const { children, pageMemberships } = await downloadAndParseCategorylinks(
    pageNS,
    catTitles,
    titleToLt,
  );

  const reachable = bfs(rootLt, children);
  console.log(`Found ${reachable.size} categories under root category "${cfg.rootTitle}"`);

  const pagesUnderRoot = pageMemberships.filter(({ catLt }) => reachable.has(catLt)).length;
  console.log(`Found ${pagesUnderRoot} total pages under root category`);

  const result = collectUserDraftMembers(reachable, pageNS, userDraftTitles, pageMemberships);

  return result;
}
