import {
  getTemplateData, templateFromTemplateData,
} from '../../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../../wiki/WikiApi';
import { promiseSequence } from '../../../utilities';

interface BrokenLinkEntry {
  article: string;
  template: string;
}

interface FixAttemptResult {
  article: string;
  originalTemplate: string;
  attemptedUrl: string;
  success: boolean;
  newTemplate?: string;
  error?: string;
}

const successed: string[] = [];

const TEMPLATE_NAME = 'יזכור';
const BASE_URL = 'https://izkor.gov.il';
const REPORT_PAGE_TITLE = 'משתמש:Sapper-bot/ניסיונות תיקון קישורי יזכור - חיפוש';
const FIX_RESULTS_PAGE_TITLE = 'משתמש:Sapper-bot/ניסיונות תיקון קישורי יזכור - חיפוש';

// ...

const { GOOGLE_SEARCH_API_KEY } = process.env;
const { GOOGLE_SEARCH_CX } = process.env;

// Delay between requests to avoid overwhelming the server
const delay = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

// Check if a URL exists and return information about it
async function checkUrl(url: string): Promise<{ exists: boolean; isBroken: boolean; finalUrl: string | null }> {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      body: null,
      method: 'GET',
    });

    const responseText = await response.text();
    const isBroken = responseText.includes('דף לא נמצא');
    const finalUrl = response.url;

    if (isBroken) {
      return { exists: false, isBroken: true, finalUrl };
    }

    return { exists: true, isBroken: false, finalUrl };
  } catch (error) {
    console.warn(`Warning checking URL ${url}:`, error.message);
    return { exists: false, isBroken: false, finalUrl: null };
  }
}

// Parse the report page to extract broken links
function parseReportPage(content: string): BrokenLinkEntry[] {
  const lines = content.split('\n');
  const brokenLinks: BrokenLinkEntry[] = [];

  for (const line of lines) {
    // Format: * [[Article Title]]: {{template content}}
    const match = line.match(/^\*\s*\[\[([^\]]+)\]\]:\s*(.+)$/);
    if (match) {
      const [, article, template] = match;
      brokenLinks.push({ article: article.trim(), template: template.trim() });
    }
  }

  return brokenLinks;
}

async function searchIzkor(name: string): Promise<string | null> {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
    console.error('Missing Google Search API credentials');
    return null;
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', GOOGLE_SEARCH_API_KEY);
    url.searchParams.append('cx', GOOGLE_SEARCH_CX);
    url.searchParams.append('q', `site:izkor.gov.il "${name}"`);
    url.searchParams.append('num', '1');

    const response = await fetch(url.toString());
    if (!response.ok) {
      const body = await response.text();
      console.error(`HTTP error! status: ${response.status}`);
      console.error(body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const { items } = data;
    if (items && items.length > 0) {
      return items[0].link;
    }
    return null;
  } catch (error) {
    console.error(`Error searching for ${name}:`, error.message);
    return null;
  }
}

function extractNameFromUrl(url: string): string | null {
  const match = url.match(/il\/([^/]+)\//);
  if (!match) return null;

  return decodeURIComponent(match[1]);
}

// Extract ID from URL (before the last /)
function extractIdFromUrl(url: string): string | null {
  // Matches .../halal/korot/<id> or .../<id>
  const match = url.match(/il\/([^/]+\/[^/]+)\/?$/);
  if (!match) return null;

  return decodeURIComponent(match[1]).replace(/ /g, '%20').replace(/"/g, '@');
}

// Attempt to fix a broken link
async function attemptFix(
  brokenLink: BrokenLinkEntry,
  getNameFromUrl = false,
): Promise<FixAttemptResult> {
  const { article, template } = brokenLink;
  if (successed.includes(template)) {
    return {
      article, originalTemplate: template, attemptedUrl: '', success: true,
    };
  }
  const params = getTemplateData(template, TEMPLATE_NAME, article);

  if (!params.arrayData) {
    return {
      article,
      originalTemplate: template,
      attemptedUrl: '',
      success: false,
      error: 'Template does not have enough parameters',
    };
  }

  const id = params.arrayData[0].trim();
  const name = params.arrayData[1]?.trim() || article;
  const isNumeric = /^\d+$/.test(id);
  let currentUrl = '';
  if (isNumeric) {
    currentUrl = `${BASE_URL}/HalalKorot.aspx?id=${id}`;
    const firstCheckResult = await checkUrl(currentUrl);

    if (firstCheckResult.exists && !firstCheckResult.isBroken) {
      return {
        article,
        originalTemplate: template,
        attemptedUrl: id,
        success: true,
      };
    }

    if (!firstCheckResult.finalUrl) {
      return {
        article,
        originalTemplate: template,
        attemptedUrl: '',
        success: false,
        error: 'No final URL found',
      };
    }
    currentUrl = firstCheckResult.finalUrl;
  } else {
    currentUrl = `${BASE_URL}/${id}`;
  }

  const nameFromUrl = extractNameFromUrl(currentUrl);
  if (!nameFromUrl) {
    return {
      article,
      originalTemplate: template,
      attemptedUrl: '',
      success: false,
      error: 'No name found in URL',
    };
  }

  const foundUrl = await searchIzkor(getNameFromUrl ? nameFromUrl : name);

  if (!foundUrl) {
    return {
      article,
      originalTemplate: template,
      attemptedUrl: '',
      success: false,
      error: 'No results found in Google Search',
    };
  }

  // Check if the found URL is valid and not broken
  await delay(100);
  const result = await checkUrl(foundUrl);

  if (!result.exists || result.isBroken) {
    return {
      article,
      originalTemplate: template,
      attemptedUrl: foundUrl,
      success: false,
      error: result.isBroken ? 'Found URL is broken' : 'Found URL does not exist',
    };
  }

  const newId = extractIdFromUrl(result.finalUrl || foundUrl);
  if (!newId) {
    return {
      article,
      originalTemplate: template,
      attemptedUrl: foundUrl,
      success: false,
      error: 'Could not extract ID from found URL',
    };
  }

  if (newId === id) {
    return {
      article,
      originalTemplate: template,
      attemptedUrl: foundUrl,
      success: false,
      error: 'Found ID is identical to broken ID',
    };
  }

  const newParams = [...params.arrayData];
  newParams[0] = newId;
  const newTemplate = templateFromTemplateData(
    { arrayData: newParams, keyValueData: params.keyValueData },
    TEMPLATE_NAME,
  );

  return {
    article,
    originalTemplate: template,
    attemptedUrl: foundUrl,
    success: true,
    newTemplate,
  };
}

// Update article with all fixed templates at once
async function updateArticle(
  api: IWikiApi,
  article: string,
  replacements: Array<{ oldTemplate: string; newTemplate: string }>,
): Promise<boolean> {
  try {
    const { content, revid } = await api.articleContent(article);
    if (!content) {
      console.error(`Could not get content for ${article}`);
      return false;
    }

    let newContent = content;
    for (const { oldTemplate, newTemplate } of replacements) {
      newContent = newContent.replace(oldTemplate, newTemplate);
    }

    if (newContent === content) {
      console.error(`No templates were replaced in ${article}`);
      return false;
    }

    await api.edit(article, 'תיקון תבנית יזכור', newContent, revid);
    console.log(`✓ Updated: ${article} (${replacements.length} template${replacements.length > 1 ? 's' : ''})`);
    return true;
  } catch (error) {
    console.error(`Error updating ${article}:`, error.message);
    return false;
  }
}

// Create comprehensive report
async function createFixReport(api: IWikiApi, results: FixAttemptResult[]): Promise<void> {
  const failedFixes = results.filter((r) => !r.success);

  let reportContent = '';

  if (failedFixes.length > 0) {
    for (const result of failedFixes) {
      reportContent += `* [[${result.article}]]: ${result.originalTemplate} - ${result.error || 'Unknown error'}\n`;
    }
    reportContent += '\n';
  }

  try {
    const [info] = await api.info([FIX_RESULTS_PAGE_TITLE]);
    const revid = info?.lastrevid;
    if (revid) {
      await api.edit(FIX_RESULTS_PAGE_TITLE, 'דוח ניסיונות תיקון קישורי יזכור', reportContent, revid);
    } else {
      await api.create(FIX_RESULTS_PAGE_TITLE, 'דוח ניסיונות תיקון קישורי יזכור', reportContent);
    }
    console.log(`\n✓ Report created: ${FIX_RESULTS_PAGE_TITLE}`);
  } catch (error) {
    console.error('Error creating report:', error.message);
  }
}

// Main execution
export default async function izkorLinksFixWithSearch() {
  const api = WikiApi();
  await api.login();

  console.log('Reading broken links report...');

  // Read the report page
  const { content } = await api.articleContent(REPORT_PAGE_TITLE);
  if (!content) {
    console.error('Could not read report page');
    return;
  }

  const brokenLinks = parseReportPage(content);
  console.log(`Found ${brokenLinks.length} broken links to fix\n`);

  if (brokenLinks.length === 0) {
    console.log('No broken links to fix');
    return;
  }

  // Attempt to fix each broken link
  const fixResults = await promiseSequence(
    1,
    brokenLinks.map((link) => async () => {
      console.log(`Processing: ${link.article}...`);
      return attemptFix(link);
    }),
  );

  // Group successful fixes by article
  const successfulFixes = fixResults.filter((result) => result.success && result.newTemplate);
  const fixesByArticle = new Map<string, Array<{ oldTemplate: string; newTemplate: string }>>();

  for (const result of successfulFixes) {
    if (!fixesByArticle.has(result.article)) {
      fixesByArticle.set(result.article, []);
    }
    fixesByArticle.get(result.article)!.push({
      oldTemplate: result.originalTemplate,
      newTemplate: result.newTemplate!,
    });
  }

  // Update each article once with all its fixes
  const updateResults = await promiseSequence(
    1,
    Array.from(fixesByArticle.entries()).map(([article, replacements]) => async () => (
      updateArticle(api, article, replacements)
    )),
  );

  const updatedArticlesCount = updateResults.filter((updated) => updated).length;

  // Create comprehensive report
  await createFixReport(api, fixResults);

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total attempts: ${fixResults.length}`);
  console.log(`Successful fixes: ${fixResults.filter((r) => r.success).length}`);
  console.log(`Failed: ${fixResults.filter((r) => !r.success).length}`);
  console.log(`Articles updated: ${updatedArticlesCount}`);
}
