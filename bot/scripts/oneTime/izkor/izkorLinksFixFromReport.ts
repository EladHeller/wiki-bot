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

const soldierRanks = [
  'סא"ל',
  'סג"ם',
  'רס"ב',
  'רס"ל',
  'רס"ן',
  'רס"מ',
  'רס"נ',
  'רב טוראי',
  'רב סמל',
  'סגן',
  'אלוף',
  'סרן',
];

const TEMPLATE_NAME = 'יזכור';
const IZKOR_BASE_URL = 'https://www.izkor.gov.il';
const BROKEN_PAGE_MESSAGE = 'דף לא נמצא';
const REPORT_PAGE_TITLE = 'משתמש:Sapper-bot/ניסיונות תיקון קישורי יזכור';
const FIX_RESULTS_PAGE_TITLE = 'משתמש:Sapper-bot/ניסיונות תיקון קישורי יזכור2';

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
    const isBroken = responseText.includes(BROKEN_PAGE_MESSAGE);
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

// Transform name for URL: replace spaces with underscores and quotes with @
function transformNameForUrl(name: string): string {
  if (!name) {
    return name;
  }
  let fixedName = name;
  for (const rank of soldierRanks) {
    fixedName = fixedName.replace(rank, '').trim();
    fixedName = fixedName.replace(rank.replace(/ /g, '%20').replace(/"/g, '@').trim(), '').trim();
  }
  fixedName = fixedName.replaceAll(/ \([^)]+\) /g, ' ').replace(/ /g, '%20').replace(/"/g, '@').trim();

  fixedName = fixedName.replaceAll(/%20{2,5}/g, '%20').trim();
  return fixedName;
}

// Extract ID from URL (before the last /)
function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/([^/]+\/[^/]+)$/);
  return match ? transformNameForUrl(decodeURIComponent(match[0])) : null;
}

// Replace name in URL
function replaceNameInUrl(url: string, newName: string): string {
  if (!newName) {
    return url;
  }
  if (url.match(/il\/[^/]+(\/[^/]+)$/)) {
    return url.replace(/il\/[^/]+(\/[^/]+)$/, `il/${newName}$1`);
  } if (url.match(/il\/en_[^/]+$/)) {
    return url.replace(/il\/(en_[^/]+)$/, `il/${newName}/$1`);
  }
  return url;
}

// Attempt to fix a broken link
async function attemptFix(
  brokenLink: BrokenLinkEntry,
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
      error: 'Template does not have enough parameters (need at least 2)',
    };
  }

  const id = params.arrayData[0].trim();
  const name = params.arrayData[1]?.trim();
  const isNumeric = /^\d+$/.test(id);

  let attemptedUrl: string = '';
  let finalUrl: string | null = null;

  try {
    if (isNumeric) {
      // Step 1: For numeric ID, call the site to get the redirected URL
      const initialUrl = `${IZKOR_BASE_URL}/HalalKorot.aspx?id=${id}`;
      await delay(100);
      const result = await checkUrl(initialUrl);

      if (!result.finalUrl || result.finalUrl === initialUrl) {
        return {
          article,
          originalTemplate: template,
          attemptedUrl: initialUrl,
          success: false,
          error: 'No redirect occurred or URL check failed',
        };
      }

      finalUrl = result.finalUrl;
      if (!result.isBroken) {
        const idFromUrl = extractIdFromUrl(finalUrl);
        if (idFromUrl && idFromUrl !== id) {
          const newTemplate = template.replace(`|${id}|`, `|${idFromUrl}|`);
          return {
            article,
            originalTemplate: template,
            attemptedUrl: finalUrl,
            success: true,
            newTemplate,
          };
        }
      }
    } else {
      // For non-numeric, construct URL directly
      finalUrl = `${IZKOR_BASE_URL}/${id}`;
    }

    const transformedName = transformNameForUrl(name);
    const fixedUrl = replaceNameInUrl(finalUrl, transformedName);
    attemptedUrl = fixedUrl;

    // Step 3: Check if the fixed URL is valid
    await delay(100);
    const fixedResult = await checkUrl(fixedUrl);

    if (!fixedResult.exists || fixedResult.isBroken) {
      return {
        article,
        originalTemplate: template,
        attemptedUrl: fixedUrl,
        success: false,
        error: fixedResult.isBroken ? 'Fixed URL is broken' : 'Fixed URL does not exist',
      };
    }

    // Extract the final ID from the validated URL
    const finalNameMatch = fixedResult.finalUrl?.match(/\/([^/]+\/[^/]+)$/);
    if (!finalNameMatch) {
      return {
        article,
        originalTemplate: template,
        attemptedUrl: fixedUrl,
        success: false,
        error: 'Could not extract final ID from validated URL',
      };
    }

    const newId = decodeURIComponent(finalNameMatch[1]).replaceAll(' ', '%20');
    const newParams = [...params.arrayData];
    newParams[0] = newId;
    const newTemplate = templateFromTemplateData(
      { arrayData: newParams, keyValueData: params.keyValueData },
      TEMPLATE_NAME,
    );

    return {
      article,
      originalTemplate: template,
      attemptedUrl: fixedUrl,
      success: true,
      newTemplate,
    };
  } catch (error) {
    return {
      article,
      originalTemplate: template,
      attemptedUrl,
      success: false,
      error: error.message,
    };
  }
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
      reportContent += `* [[${result.article}]]: ${result.originalTemplate}`;
    }
    reportContent += '\n';
  }

  try {
    const [info] = await api.info([FIX_RESULTS_PAGE_TITLE]);
    const revid = info?.lastrevid;
    if (!revid) {
      throw new Error('Failed to get revid');
    }
    await api.create(FIX_RESULTS_PAGE_TITLE, 'דוח ניסיות תיקון קישורי יזכור', reportContent);
    console.log(`\n✓ Report created: ${FIX_RESULTS_PAGE_TITLE}`);
  } catch (error) {
    console.error('Error creating report:', error.message);
  }
}

// Main execution
export default async function izkorLinksFixFromReport() {
  const api = WikiApi();
  await api.login();

  console.log('Reading broken links report...');

  // Read the report page
  const { content } = await api.articleContent(REPORT_PAGE_TITLE);
  if (!content) {
    console.error('Could not read report page');
    return;
  }

  const brokenLinks = parseReportPage(content).filter(
    (link) => soldierRanks.some((rank) => link.template.includes(rank)),
  );
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
    let replacements = fixesByArticle.get(result.article);
    if (!replacements) {
      replacements = [];
      fixesByArticle.set(result.article, replacements);
    }
    replacements.push({
      oldTemplate: result.originalTemplate,
      newTemplate: result.newTemplate ?? '',
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
