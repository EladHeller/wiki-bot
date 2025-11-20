import { findTemplates, getTemplateArrayData } from '../../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../../wiki/WikiApi';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../../../utilities';

interface BrokenLink {
  article: string;
  template: string;
}

interface ProcessingResults {
  updatedPages: string[];
  brokenLinks: BrokenLink[];
  errorPages: Map<string, string>;
  edgeCases: Map<string, string>;
}

const TEMPLATE_NAME = 'יזכור';
const IZKOR_BASE_URL = 'https://www.izkor.gov.il';
const BROKEN_PAGE_MESSAGE = 'דף לא נמצא';

const emptyResults = (): ProcessingResults => ({
  updatedPages: [],
  brokenLinks: [],
  errorPages: new Map(),
  edgeCases: new Map(),
});

function decodeUrlId(encodedId: string): string {
  return decodeURIComponent(encodedId).replace(/ /g, '%20');
}

// Delay between requests to avoid overwhelming the server
async function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Check if a URL exists and return information about it
async function checkUrl(url: string): Promise<{ exists: boolean; isBroken: boolean; finalUrl: string | null }> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        priority: 'u=0, i',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        cookie: 'visid_incap_1068888=GwtsBt/eTCiL88IBj4aGpl6a22gAAAAAQUIPAAAAAACXFeFjqc1W7iaK8TYhlWY7; _gcl_au=1.1.63707159.1759222368; _ga=GA1.1.153868163.1759222368; _tt_enable_cookie=1; _ttp=01K6CX625Y1B11BXHTCQJBD8MR_.tt.2; ttcsid=1759222368447::tE6Yqo0OEaJt17UCDj2I.1.1759222368653.0; ttcsid_CREOUCBC77UB15K04HM0=1759222368447::ksEdXFmcK9zg1J_2ckTv.1.1759222368653.0; nlbi_1068888=AcmVebp8xnIXJQDWT/Ry9AAAAAB8JYev7z1p+bWw8yM91VXt; incap_ses_1000_1068888=O5TsPwyUwDmLbsptKrfgDesAGmkAAAAAaIYj17ZwANOpDu/MzjTmsg==; incap_ses_254_1068888=A3sNYwdiOHN31aHrG2SGAxTAGmkAAAAAwclZVwdyllPgp5LhBT8x5A==; _ga_QFRVQP575H=GS2.1.s1763360787$o9$g0$t1763360787$j60$l0$h0; _clck=1yrtvmz%5E2%5Eg13%5E0%5E2099; _clsk=1my2ore%5E1763360789171%5E1%5E1%5Eb.clarity.ms%2Fcollect',
      },
      body: null,
      method: 'GET',
    });

    const responseText = await response.text();
    const isBroken = responseText.includes(BROKEN_PAGE_MESSAGE);
    const finalUrl = response.url;

    if (isBroken) {
      return { exists: false, isBroken: true, finalUrl: null };
    }

    return { exists: true, isBroken: false, finalUrl };
  } catch (error) {
    console.warn(`Warning checking URL ${url}:`, error.message);
    return { exists: false, isBroken: false, finalUrl: null };
  }
}

// Reverse name order in URL (swap parts around %20)
function reverseNameInUrl(url: string): string {
  // Extract the part before /en_ or similar
  const match = url.match(/^(https:\/\/www\.izkor\.gov\.il\/)([^/]+%20[^/]+)(\/?.*)$/);
  if (!match) {
    return url;
  }

  const [, base, namePart, rest] = match;
  const names = namePart.split('%20');
  if (names.length === 2) {
    const reversed = `${decodeUrlId(names[1])}%20${decodeUrlId(names[0])}`;
    return `${base}${reversed}${rest}`;
  }

  return url;
}

// Process variation 1: non-numeric ID
async function processVariation1(
  id: string,
  template: string,
): Promise<{
  fixed: boolean;
  newTemplate?: string;
  broken?: boolean;
  edgeCase?: { article: string; details: string };
}> {
  const url = `${IZKOR_BASE_URL}/${id}`;

  await delay(100); // Rate limiting
  const result = await checkUrl(url);

  if (result.exists) {
    return { fixed: false }; // Already correct
  }

  // Try reversing name order
  const reversedUrl = reverseNameInUrl(url);
  if (reversedUrl !== url) {
    await delay(100);
    const reversedResult = await checkUrl(reversedUrl);
    if (reversedResult.exists) {
      // Extract new ID from final URL and decode it
      const match = reversedResult.finalUrl?.match(/\/([^/]+\/[^/]+)$/);
      if (match) {
        const newId = decodeUrlId(match[1]);
        const newTemplate = template.replace(`|${id}|`, `|${newId}|`);
        return { fixed: true, newTemplate };
      }
    }
  }

  // Broken link - couldn't be fixed
  return { fixed: false, broken: true };
}

// Process variation 2: numeric ID
async function processVariation2(
  id: string,
  articleTitle: string,
  template: string,
): Promise<{
  fixed: boolean;
  newTemplate?: string;
  broken?: boolean;
  edgeCase?: { article: string; details: string };
}> {
  const url = `${IZKOR_BASE_URL}/HalalKorot.aspx?id=${id}`;

  await delay(100); // Rate limiting
  const result = await checkUrl(url);

  if (!result.exists && result.isBroken) {
    return { fixed: false, broken: true };
  }

  if (!result.exists && !result.isBroken) {
    return {
      fixed: false,
      edgeCase: { article: articleTitle, details: `URL: ${url}, Final: ${result.finalUrl}` },
    };
  }

  if (result.finalUrl && result.finalUrl !== url) {
    const match = result.finalUrl.match(/\/([^/]+\/[^/]+)$/);
    if (match) {
      const newId = decodeUrlId(match[1]);
      const newTemplate = template.replace(`|${id}|`, `|${newId}|`);
      return { fixed: true, newTemplate };
    }
  }

  return { fixed: false };
}

interface TemplateProcessResult {
  updated: string | null;
  brokenLink?: BrokenLink;
  error?: { article: string; message: string };
  edgeCase?: { article: string; details: string };
}

// Process a single template and return updated content if needed
async function processTemplateItem(
  template: string,
  articleTitle: string,
): Promise<TemplateProcessResult> {
  const params = getTemplateArrayData(template, TEMPLATE_NAME, articleTitle);

  if (!params || params.length === 0) {
    return { updated: null };
  }

  const id = params[0].trim();
  const isNumeric = /^\d+$/.test(id);

  try {
    const result = isNumeric
      ? await processVariation2(id, articleTitle, template)
      : await processVariation1(id, template);

    return {
      updated: result.fixed && result.newTemplate ? result.newTemplate : null,
      brokenLink: result.broken ? { article: articleTitle, template } : undefined,
      edgeCase: result.edgeCase,
    };
  } catch (error) {
    console.error(`Error processing ${articleTitle}:`, error.message);
    return {
      updated: null,
      error: { article: articleTitle, message: error.message },
    };
  }
}

interface ArticleProcessResult {
  updated: boolean;
  updatedPage?: string;
  brokenLinks: BrokenLink[];
  errors: Array<{ article: string; message: string }>;
  edgeCases: Array<{ article: string; details: string }>;
}

// Main processing function
async function processTemplate(
  api: IWikiApi,
  articleTitle: string,
  content: string,
  revid: number,
): Promise<ArticleProcessResult> {
  const templates = findTemplates(content, TEMPLATE_NAME, articleTitle);

  if (templates.length === 0) {
    return {
      updated: false, brokenLinks: [], errors: [], edgeCases: [],
    };
  }

  const processedTemplates = await promiseSequence(
    1,
    templates.map((template) => async () => (
      processTemplateItem(template, articleTitle)
    )),
  );

  const newContent = processedTemplates.reduce((acc, result, index) => (
    result.updated ? acc.replace(templates[index], result.updated) : acc
  ), content);

  const brokenLinks = processedTemplates
    .map((r) => r.brokenLink)
    .filter((r): r is BrokenLink => r !== undefined);
  const errors = processedTemplates
    .map((r) => r.error)
    .filter((r): r is { article: string; message: string } => r !== undefined);
  const edgeCases = processedTemplates
    .map((r) => r.edgeCase)
    .filter((r): r is { article: string; details: string } => r !== undefined);

  const anyUpdated = newContent !== content;

  if (anyUpdated) {
    try {
      await api.edit(articleTitle, 'תיקון תבנית יזכור', newContent, revid);
      return {
        updated: true, updatedPage: articleTitle, brokenLinks, errors, edgeCases,
      };
    } catch (error) {
      console.error(`Error editing ${articleTitle}:`, error.message);
      return {
        updated: false,
        brokenLinks,
        errors: [...errors, { article: articleTitle, message: error.message }],
        edgeCases,
      };
    }
  }

  return {
    updated: false, brokenLinks, errors, edgeCases,
  };
}

// Create report page if there are broken links
async function createReportPage(api: IWikiApi, brokenLinks: BrokenLink[]): Promise<void> {
  if (brokenLinks.length === 0) {
    console.log('No broken links to report');
    return;
  }

  const reportTitle = 'משתמש:Sapper-bot/קישורים שבורים לאתר יזכור';
  const reportContent = brokenLinks
    .map((link) => `* [[${link.article}]]: ${link.template}`)
    .join('\n');

  try {
    await api.create(reportTitle, 'דוח קישורים שבורים לאתר יזכור', reportContent);
    console.log(`Report page created: ${reportTitle}`);
  } catch (error) {
    console.error('Error creating report page:', error.message);
  }
}

// Merge processing results
const mergeResults = (acc: ProcessingResults, result: ArticleProcessResult): ProcessingResults => ({
  updatedPages: result.updatedPage ? [...acc.updatedPages, result.updatedPage] : acc.updatedPages,
  brokenLinks: [...acc.brokenLinks, ...result.brokenLinks],
  errorPages: result.errors.reduce(
    (map, err) => new Map(map).set(err.article, err.message),
    acc.errorPages,
  ),
  edgeCases: result.edgeCases.reduce(
    (map, edge) => new Map(map).set(edge.article, edge.details),
    acc.edgeCases,
  ),
});

// Process single page
async function processPage(api: IWikiApi, page: any): Promise<ArticleProcessResult> {
  const content = page.revisions?.[0].slots.main['*'];
  const revid = page.revisions?.[0].revid;
  if (!content) {
    console.log('No content for', page.title);
    return {
      updated: false, brokenLinks: [], errors: [], edgeCases: [],
    };
  }

  const result = await processTemplate(api, page.title, content, revid);
  if (result.updated) {
    console.log('Updated:', page.title);
  }
  return result;
}

// Print summary
function printSummary(results: ProcessingResults): void {
  console.log('\n=== Summary ===');
  console.log(`Updated pages: ${results.updatedPages.length}`);
  console.log(`Broken links: ${results.brokenLinks.length}`);
  console.log(`Errors: ${results.errorPages.size}`);
  console.log(`Edge cases: ${results.edgeCases.size}`);

  if (results.updatedPages.length > 0) {
    console.log('\nUpdated:', results.updatedPages.join(', '));
  }

  if (results.brokenLinks.length > 0) {
    console.log('\nBroken links articles:', results.brokenLinks.map((l) => l.article).join(', '));
  }

  if (results.errorPages.size > 0) {
    console.log('\nErrors:');
    results.errorPages.forEach((msg, article) => console.log(`  ${article}: ${msg}`));
  }

  if (results.edgeCases.size > 0) {
    console.log('\nEdge cases:');
    results.edgeCases.forEach((details, article) => console.log(`  ${article}: ${details}`));
  }
}

// Main execution
export default async function izkorLinksFix() {
  const api = WikiApi();
  await api.login();

  console.log('Starting Izkor links fix...');

  const generator = api.getArticlesWithTemplate(TEMPLATE_NAME);

  const allResults = await asyncGeneratorMapWithSequence(1, generator, (page) => async () => (
    processPage(api, page)
  ));

  const finalResults = allResults
    .filter((result): result is ArticleProcessResult => result !== undefined)
    .reduce(mergeResults, emptyResults());

  await createReportPage(api, finalResults.brokenLinks);
  printSummary(finalResults);
}
