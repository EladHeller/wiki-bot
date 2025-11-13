import { createGunzip } from 'zlib';
import { createWriteStream, createReadStream, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { createInterface } from 'readline';

/* -------------------- Constants & Config -------------------- */

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

/* -------------------- Data Models -------------------- */

type Title = string;
type LtId = number;
type PageId = number;

type TitleToLt = Map<Title, LtId>;
type PageNSMap = Map<PageId, NS>;
type PageTitleMap = Map<PageId, Title>;
type ChildrenMap = Map<LtId, LtId[]>;

/* -------------------- Download & Decompress -------------------- */

/**
 * Get temp file path for a URL (in /tmp for Lambda)
 */
function getTempPath(url: string): string {
  const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
  const filename = `dump-${hash}.sql`;
  return join('/tmp', filename);
}

/**
 * Download a gzipped file, decompress it to /tmp, and return the file path
 */
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

  // Ensure /tmp exists
  mkdirSync('/tmp', { recursive: true });

  // Download and decompress, streaming to file
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

  // Pump data through gunzip
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done: readerDone } = await reader.read();
    if (readerDone) {
      gunzip.end();
      break;
    }
    gunzip.write(Buffer.from(value));
  }

  await Promise.all([gunzipError, writeFinished]);

  console.log(`Decompressed to ${tempPath}`);
  return tempPath;
}

/* -------------------- SQL Parser (Simple) -------------------- */

/**
 * Parse a single field value
 */
function parseField(value: string): any {
  if (value === 'NULL') {
    return null;
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    // String value - unescape
    return value
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }
  if (!Number.isNaN(Number(value)) && value !== '') {
    return Number(value);
  }
  return value;
}

/**
 * Parse SQL INSERT VALUES - extract rows from INSERT statement
 * Uses streaming to handle large files without loading entire file into memory
 */
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

    // Check if we're starting an INSERT statement
    if (!inInsert && buffer.includes('INSERT INTO')) {
      inInsert = true;
    }

    // If we're in an INSERT and the line ends with semicolon, process it
    if (inInsert && buffer.includes(';')) {
      // Extract the INSERT statement
      const insertMatch = /INSERT\s+INTO\s+`[^`]+`\s+VALUES\s+(.+?);/is.exec(buffer);

      if (insertMatch) {
        const valuesSection = insertMatch[1];

        // Split into individual rows
        const rowRegex = /\(([^)]+(?:\([^)]*\)[^)]*)*)\)/g;
        let rowMatch;

        // eslint-disable-next-line no-cond-assign
        while ((rowMatch = rowRegex.exec(valuesSection)) !== null) {
          const rowText = rowMatch[1];
          const fields: any[] = [];

          // Parse fields within the row
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
              // End of field
              fields.push(parseField(field.trim()));
              field = '';
            } else {
              field += char;
            }
          }

          // Add last field
          if (field) {
            fields.push(parseField(field.trim()));
          }

          if (fields.length > 0) {
            rowCount += 1;
            yield fields;
          }
        }
      }

      // Clear buffer after processing
      buffer = '';
      inInsert = false;
    }
  }

  console.log(`Parsed ${rowCount} total rows from file`);
}

/* -------------------- Pure-ish helpers -------------------- */

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
  // fallback (shouldn't happen; we filter to 2/118)
  return title;
};

/* -------------------- Loaders (download & parse) -------------------- */

/**
 * Download and parse linktarget.sql.gz
 * Returns: (14,title) -> lt_id map, and root lt_id
 */
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
    // lt_id, lt_namespace, lt_title
    if (row.length < 3) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const ltId = row[0] as number;
    const ltNamespace = row[1] as number;
    const ltTitle = row[2] as string;

    if (ltNamespace === CATEGORY_NS && ltTitle) {
      categoryCount += 1;
      titleToLt.set(ltTitle, ltId);
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

/**
 * Download and parse page.sql.gz
 * Returns: page_id -> namespace map, and page_id -> title maps for needed namespaces
 */
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

  // Parse INSERT statements - page table has many columns, we need: page_id (0), page_namespace (1), page_title (2)
  for await (const row of parseSqlFile(filePath)) {
    if (row.length < 3) {
      // eslint-disable-next-line no-continue
      continue;
    }
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

  return { pageNS, userDraftTitles, catTitles };
}

/**
 * Download and parse categorylinks.sql.gz
 * Returns: parent lt_id -> child lt_id map (for subcat), and page memberships
 */
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

  // categorylinks: cl_from, cl_to, cl_timestamp, cl_sortkey, cl_type, cl_collation, cl_target_id
  // We need: cl_from (0), cl_type (4), cl_target_id (6)
  for await (const row of parseSqlFile(filePath)) {
    if (row.length < 7) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const clFrom = row[0] as number;
    const clType = row[4] as string;
    const clTargetId = row[6] as number | null;

    if (!clFrom || !clType || !clTargetId) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (clType === 'subcat') {
      // Build category hierarchy: parent lt_id -> child lt_id
      if (pageNS.get(clFrom) !== CATEGORY_NS) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const childTitle = catTitles.get(clFrom);
      if (!childTitle) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const childLt = titleToLt.get(childTitle);
      if (!childLt) {
        // eslint-disable-next-line no-continue
        continue;
      }
      setPush(children, clTargetId, childLt);
    } else if (clType === 'page') {
      // Store page memberships
      pageMemberships.push({ pageId: clFrom, catLt: clTargetId });
    }
  }

  return { children, pageMemberships };
}

/* -------------------- Main Logic -------------------- */

/**
 * Collect user/draft page titles under reachable categories
 */
function collectUserDraftMembers(
  reachable: Set<LtId>,
  pageNS: PageNSMap,
  userDraftTitles: PageTitleMap,
  pageMemberships: Array<{ pageId: PageId; catLt: LtId }>,
): string[] {
  const result: string[] = [];
  const printed = new Set<PageId>(); // prevent duplicates

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

/* -------------------- Main (composition) -------------------- */

/**
 * Main function: downloads SQL dumps, parses them, and returns formatted page titles
 * @returns Array of formatted page titles (e.g., ["User:Title", "Draft:Title"])
 */
export default async function main(): Promise<string[]> {
  // Download and parse linktarget and page first (can be done in parallel)
  const [{ titleToLt, rootLt }, { pageNS, userDraftTitles, catTitles }] = await Promise.all([
    downloadAndParseLinktarget(),
    downloadAndParsePage(),
  ]);

  // Now parse categorylinks (needs linktarget and page data)
  const { children, pageMemberships } = await downloadAndParseCategorylinks(
    pageNS,
    catTitles,
    titleToLt,
  );

  // Traverse from root
  const reachable = bfs(rootLt, children);
  console.log(`Found ${reachable.size} categories under root category "${cfg.rootTitle}"`);

  // Count total pages under reachable categories
  const pagesUnderRoot = pageMemberships.filter(({ catLt }) => reachable.has(catLt)).length;
  console.log(`Found ${pagesUnderRoot} total pages under root category`);

  // Collect user/draft page titles
  const result = collectUserDraftMembers(reachable, pageNS, userDraftTitles, pageMemberships);

  return result;
}
