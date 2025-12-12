import WikiApi from '../../wiki/WikiApi';
import { WikiPage } from '../../types';
import { escapeRegex, promiseSequence } from '../../utilities';

const TEMPLATE_REPLACEMENTS = [
  { from: 'הבהרה משפטית', to: '{{הסתייגות|משפטית}}' },
  { from: 'הבהרה הלכתית', to: '{{הסתייגות|הלכתית}}' },
  { from: 'הבהרה סקרי בחירות', to: '{{הסתייגות|סקרי בחירות}}' },
  { from: 'הבהרה רפואית', to: '{{הסתייגות|רפואית}}' },
  { from: 'הבהרה דף משתמש', to: '{{הסתייגות|דף משתמש}}' },
] as const;

type ChangeStats = Record<string, number>;

function createTemplateRegex(templateName: string): RegExp {
  return new RegExp(`\\{\\{\\s*${escapeRegex(templateName)}\\|?\\s*\\}\\}`, 'g');
}

function countMatches(content: string, templateName: string): number {
  const regex = createTemplateRegex(templateName);
  return (content.match(regex) || []).length;
}

function replaceTemplate(content: string, fromTemplate: string, toTemplate: string): string {
  return content.replace(createTemplateRegex(fromTemplate), toTemplate);
}

function processPageContent(content: string): { newContent: string; pageStats: ChangeStats } {
  const pageStats: ChangeStats = {};

  const newContent = TEMPLATE_REPLACEMENTS.reduce((acc, { from, to }) => {
    const matchCount = countMatches(acc, from);
    if (matchCount > 0) {
      pageStats[from] = matchCount;
    }
    return replaceTemplate(acc, from, to);
  }, content);

  return { newContent, pageStats };
}

function mergeStats(totalStats: ChangeStats, pageStats: ChangeStats): ChangeStats {
  const merged = { ...totalStats };
  Object.entries(pageStats).forEach(([key, value]) => {
    merged[key] = (merged[key] || 0) + value;
  });
  return merged;
}

async function collectPagesFromGenerator(generator: AsyncGenerator<WikiPage[], void, void>): Promise<WikiPage[]> {
  const pages: WikiPage[] = [];
  for await (const batch of generator) {
    pages.push(...batch);
  }
  return pages;
}

async function processPage(
  api: ReturnType<typeof WikiApi>,
  page: WikiPage,
): Promise<ChangeStats> {
  const content = page.revisions?.[0]?.slots.main['*'];
  const revid = page.revisions?.[0]?.revid;
  const pageId = page.pageid;

  if (!revid || !content || !pageId) {
    console.log(`Missing revid, content, or pageid for ${page.title}`);
    return {};
  }

  const { newContent, pageStats } = processPageContent(content);

  if (Object.keys(pageStats).length === 0) {
    return {};
  }

  const summary = 'הסבת תבניות הבהרה לתבנית הסתייגות';

  try {
    await api.edit(page.title, summary, newContent, revid);
    return pageStats;
  } catch (error: any) {
    console.error(`✗ Failed to update ${page.title}:`, error.message);
    return {};
  }
}

function printFinalStats(stats: ChangeStats, totalPages: number, uniquePages: number): void {
  console.log('\n========== Summary ==========');
  console.log(`Total pages checked: ${totalPages}`);
  console.log(`Total unique pages edited: ${uniquePages}`);
  console.log('\nChanges by template type:');

  TEMPLATE_REPLACEMENTS.forEach(({ from }) => {
    const count = stats[from] || 0;
    console.log(`  {{${from}}}: ${count}`);
  });

  const totalChanges = Object.values(stats).reduce((sum, count) => sum + count, 0);
  console.log(`\nTotal replacements: ${totalChanges}`);
  console.log('==============================\n');
}

export default async function replaceDisclaimerTemplates() {
  const api = WikiApi();
  await api.login();

  console.log('Starting disclaimer templates replacement...\n');
  TEMPLATE_REPLACEMENTS.forEach(({ from, to }) => {
    console.log(`  {{${from}}} → ${to}`);
  });
  console.log('');

  const processedPages = new Set<number>();
  let totalStats: ChangeStats = {};
  let editedPagesCount = 0;

  const allPagesPromises = TEMPLATE_REPLACEMENTS.map(({ from }) => collectPagesFromGenerator(api.getArticlesWithTemplate(from, undefined, 'תבנית', '*')));

  const pagesPerTemplate = await Promise.all(allPagesPromises);
  const allPages = pagesPerTemplate.flat();

  console.log(`Found ${allPages.length} pages to check\n`);

  await promiseSequence(10, allPages.map((page) => async () => {
    if (processedPages.has(page.pageid)) return;
    processedPages.add(page.pageid);
    const pageStats = await processPage(api, page);
    if (Object.keys(pageStats).length > 0) {
      totalStats = mergeStats(totalStats, pageStats);
      editedPagesCount += 1;
    }
  }));

  printFinalStats(totalStats, allPages.length, editedPagesCount);
}
