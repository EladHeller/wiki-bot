import { WikiPage } from '../../types';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import WikiDataAPI, { IWikiDataAPI } from '../../wiki/WikidataAPI';

export type ManualPairRule = {
  name: string;
  generalPattern: string;
  femininePattern: string;
};

export type AutoTransformRule = {
  name: string;
  generalSuffix: string;
  feminineSuffix: string;
};

export type CategoryPair = {
  general: string;
  feminine: string;
  rule: string;
  autoDetected: boolean;
};

export type PlannedPageChange = {
  pageTitle: string;
  categoriesAdded: string[];
  matchingRules: string[];
  genderAutoDetected: boolean;
};

export type SyncReport = {
  dryRun: boolean;
  pairsProcessed: number;
  pagesChanged: number;
  plannedChanges: PlannedPageChange[];
  skippedPairs: Array<{ pair: CategoryPair; reason: string }>;
};

export type GenderedCategorySyncConfig = {
  dryRun?: boolean;
  editSummary?: string;
  maxCategoryMembers?: number;
  manualPairRules?: ManualPairRule[];
  autoTransformRules?: AutoTransformRule[];
  autoScanPrefixes?: string[];
  whitelistPairs?: CategoryPair[];
  blacklistCategories?: string[];
};

type ParsedCategory = {
  name: string;
  sortKey: string;
};

type PageState = {
  title: string;
  content: string;
  revid: number;
};

const FEMALE_QID = 'Q6581072';

const DEFAULT_MANUAL_RULES: ManualPairRule[] = [
  { name: 'בוגרי/בוגרות', generalPattern: 'בוגרי {X}', femininePattern: 'בוגרות {X}' },
  { name: 'דוקטור/דוקטור', generalPattern: 'בעלי תואר דוקטור {X}', femininePattern: 'בעלות תואר דוקטור {X}' },
  { name: 'שחקנים/שחקניות', generalPattern: 'שחקנים {X}', femininePattern: 'שחקניות {X}' },
  { name: 'במאים/במאיות', generalPattern: 'במאים {X}', femininePattern: 'במאיות {X}' },
  { name: 'זוכי/זוכות', generalPattern: 'זוכי {X}', femininePattern: 'זוכות {X}' },
  { name: 'סופרים/סופרות', generalPattern: 'סופרים {X}', femininePattern: 'סופרות {X}' },
];

const DEFAULT_AUTO_RULES: AutoTransformRule[] = [
  { name: 'ים->יות', generalSuffix: 'ים', feminineSuffix: 'יות' },
  { name: 'י->ות', generalSuffix: 'י', feminineSuffix: 'ות' },
];

const DEFAULT_AUTO_SCAN_PREFIXES = [
  'בוגרי ',
  'שחקנים ',
  'מדענים ',
  'במאים ',
  'זוכי ',
  'סופרים ',
];

const CATEGORY_REGEX = /\[\[\s*קטגוריה\s*:\s*([^\]|]+)(?:\|([^\]]*))?\s*\]\]/g;

function normalizeCategoryName(name: string): string {
  return name.replace(/^קטגוריה:/, '').trim();
}

function patternPrefix(pattern: string): string {
  const idx = pattern.indexOf('{X}');
  return idx >= 0 ? pattern.slice(0, idx) : pattern;
}

function applyPattern(pattern: string, value: string): string {
  return pattern.replace('{X}', value);
}

function extractPatternValue(pattern: string, category: string): string | null {
  const [start, end] = pattern.split('{X}');
  if (!category.startsWith(start)) return null;
  if (!category.endsWith(end)) return null;
  return category.slice(start.length, category.length - end.length).trim();
}

function buildPairFromCategoryByManualRule(category: string, rule: ManualPairRule): CategoryPair | null {
  const generalValue = extractPatternValue(rule.generalPattern, category);
  if (generalValue !== null) {
    return {
      general: applyPattern(rule.generalPattern, generalValue),
      feminine: applyPattern(rule.femininePattern, generalValue),
      rule: `manual:${rule.name}`,
      autoDetected: false,
    };
  }

  const feminineValue = extractPatternValue(rule.femininePattern, category);
  if (feminineValue !== null) {
    return {
      general: applyPattern(rule.generalPattern, feminineValue),
      feminine: applyPattern(rule.femininePattern, feminineValue),
      rule: `manual:${rule.name}`,
      autoDetected: false,
    };
  }

  return null;
}

function buildPairFromCategoryByAutoRule(category: string, rule: AutoTransformRule): CategoryPair | null {
  const words = category.split(' ');
  if (!words.length) return null;

  const firstWord = words[0];
  const rest = words.slice(1).join(' ');

  if (firstWord.endsWith(rule.generalSuffix)) {
    const stem = firstWord.slice(0, firstWord.length - rule.generalSuffix.length);
    const feminineWord = `${stem}${rule.feminineSuffix}`;
    return {
      general: category,
      feminine: [feminineWord, rest].filter(Boolean).join(' '),
      rule: `auto:${rule.name}`,
      autoDetected: true,
    };
  }

  if (firstWord.endsWith(rule.feminineSuffix)) {
    const stem = firstWord.slice(0, firstWord.length - rule.feminineSuffix.length);
    const generalWord = `${stem}${rule.generalSuffix}`;
    return {
      general: [generalWord, rest].filter(Boolean).join(' '),
      feminine: category,
      rule: `auto:${rule.name}`,
      autoDetected: true,
    };
  }

  return null;
}

function isLikelyPeopleCategory(categoryName: string): boolean {
  const needles = ['ים', 'יות', 'ות', 'אישים', 'אנשים', 'נשים', 'שחקנ', 'בוגר', 'במא', 'סופר', 'מדענ'];
  return needles.some((n) => categoryName.includes(n));
}

async function categoryExists(api: IWikiApi, category: string): Promise<boolean> {
  const [info] = await api.info([`קטגוריה:${category}`]);
  return !info?.missing;
}

async function validatePair(api: IWikiApi, pair: CategoryPair): Promise<{ valid: boolean; reason?: string }> {
  if (!isLikelyPeopleCategory(pair.general) || !isLikelyPeopleCategory(pair.feminine)) {
    return { valid: false, reason: 'not-a-people-category' };
  }

  const [generalExists, feminineExists] = await Promise.all([
    categoryExists(api, pair.general),
    categoryExists(api, pair.feminine),
  ]);

  if (!generalExists || !feminineExists) {
    return { valid: false, reason: 'missing-sibling-category' };
  }

  return { valid: true };
}

export function parseCategories(content: string): ParsedCategory[] {
  const categories: ParsedCategory[] = [];
  for (const match of content.matchAll(CATEGORY_REGEX)) {
    categories.push({
      name: normalizeCategoryName(match[1]),
      sortKey: match[2] ?? '',
    });
  }
  return categories;
}

function buildCategoryText(categories: ParsedCategory[]): string {
  return categories.map((c) => `[[קטגוריה:${c.name}${c.sortKey ? `|${c.sortKey}` : ''}]]`).join('\n');
}

function normalizeCategoryOrdering(categories: ParsedCategory[], pairs: CategoryPair[]): ParsedCategory[] {
  const working = [...categories];

  for (const pair of pairs) {
    const femIndex = working.findIndex((c) => c.name === pair.feminine);
    const genIndex = working.findIndex((c) => c.name === pair.general);

    if (femIndex === -1 || genIndex === -1) continue;
    if (genIndex === femIndex + 1) continue;

    const fem = working[femIndex];
    const gen = working[genIndex];
    const firstIndex = Math.min(femIndex, genIndex);

    const filtered = working.filter((c) => c.name !== pair.feminine && c.name !== pair.general);
    filtered.splice(firstIndex, 0, fem, gen);
    working.splice(0, working.length, ...filtered);
  }

  const normal: ParsedCategory[] = [];
  const birth: ParsedCategory[] = [];
  const death: ParsedCategory[] = [];

  for (const category of working) {
    if (category.name.startsWith('נולדו ב-')) {
      birth.push(category);
    } else if (category.name.startsWith('נפטרו ב-')) {
      death.push(category);
    } else {
      normal.push(category);
    }
  }

  return [...normal, ...birth, ...death];
}

export function applyCategoryChanges(
  content: string,
  additions: string[],
  knownPairs: CategoryPair[],
): { changed: boolean; content: string } {
  const parsed = parseCategories(content);
  const existing = new Set(parsed.map((c) => c.name));

  for (const category of additions) {
    if (!existing.has(category)) {
      parsed.push({ name: category, sortKey: '' });
      existing.add(category);
    }
  }

  const ordered = normalizeCategoryOrdering(parsed, knownPairs);
  const withoutCategories = content.replaceAll(CATEGORY_REGEX, '').trimEnd();
  const nextContent = `${withoutCategories}\n\n${buildCategoryText(ordered)}\n`;

  return {
    changed: nextContent !== content,
    content: nextContent,
  };
}

async function fetchPageState(api: IWikiApi, title: string, pageFromCategory?: WikiPage): Promise<PageState> {
  const fromGenerator = pageFromCategory?.revisions?.[0]?.slots?.main?.['*'];
  const fromGeneratorRev = pageFromCategory?.revisions?.[0]?.revid;
  if (fromGenerator && fromGeneratorRev) {
    return { title, content: fromGenerator, revid: fromGeneratorRev };
  }

  const { content, revid } = await api.articleContent(title);
  return { title, content, revid };
}

async function isFemaleByWikidata(
  wikiApi: IWikiApi,
  wikidataApi: IWikiDataAPI,
  pageTitle: string,
): Promise<boolean | null> {
  try {
    const qid = await wikiApi.getWikiDataItem(pageTitle);
    if (!qid) return null;
    const entity = await wikidataApi.readEntity(qid, 'claims');
    const claims = entity?.claims?.P21 ?? [];
    if (!claims.length) return null;

    const female = claims.some((claim) => claim?.mainsnak?.datavalue?.value?.id === FEMALE_QID);
    return female;
  } catch {
    return null;
  }
}

function isFemaleByInfoboxHeuristic(content: string): boolean | null {
  if (/\|\s*מין\s*=\s*נקבה/i.test(content)) return true;
  if (/\|\s*מגדר\s*=\s*נקבה/i.test(content)) return true;
  return null;
}

function isFemaleByCategoriesHeuristic(content: string, feminineCategories: Set<string>): boolean | null {
  const categories = parseCategories(content);
  if (categories.some((c) => feminineCategories.has(c.name))) {
    return true;
  }
  return null;
}

async function detectFemale(
  wikiApi: IWikiApi,
  wikidataApi: IWikiDataAPI,
  pageTitle: string,
  pageContent: string,
  feminineCategories: Set<string>,
): Promise<{ female: boolean; autoDetected: boolean }> {
  const byWd = await isFemaleByWikidata(wikiApi, wikidataApi, pageTitle);
  if (byWd !== null) {
    return { female: byWd, autoDetected: true };
  }

  const byCategory = isFemaleByCategoriesHeuristic(pageContent, feminineCategories);
  if (byCategory !== null) {
    return { female: byCategory, autoDetected: true };
  }

  const byInfobox = isFemaleByInfoboxHeuristic(pageContent);
  if (byInfobox !== null) {
    return { female: byInfobox, autoDetected: true };
  }

  return { female: false, autoDetected: false };
}

async function collectCategoryNamesByPrefix(api: IWikiApi, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for await (const batch of api.categoriesStartsWith(prefix)) {
    for (const row of batch as Array<Record<string, unknown>>) {
      const rawName = row['*'];
      if (typeof rawName === 'string') out.push(normalizeCategoryName(rawName));
    }
  }
  return out;
}

async function discoverPairs(api: IWikiApi, config: GenderedCategorySyncConfig): Promise<CategoryPair[]> {
  const manualRules = config.manualPairRules ?? DEFAULT_MANUAL_RULES;
  const autoRules = config.autoTransformRules ?? DEFAULT_AUTO_RULES;
  const autoPrefixes = config.autoScanPrefixes ?? DEFAULT_AUTO_SCAN_PREFIXES;

  const pairByKey = new Map<string, CategoryPair>();

  for (const rule of manualRules) {
    const prefixes = [patternPrefix(rule.generalPattern), patternPrefix(rule.femininePattern)];
    for (const prefix of prefixes) {
      const categories = await collectCategoryNamesByPrefix(api, prefix);
      for (const category of categories) {
        const pair = buildPairFromCategoryByManualRule(category, rule);
        if (pair) {
          pairByKey.set(`${pair.general}::${pair.feminine}`, pair);
        }
      }
    }
  }

  for (const prefix of autoPrefixes) {
    const categories = await collectCategoryNamesByPrefix(api, prefix);
    for (const category of categories) {
      for (const autoRule of autoRules) {
        const pair = buildPairFromCategoryByAutoRule(category, autoRule);
        if (pair) {
          pairByKey.set(`${pair.general}::${pair.feminine}`, pair);
        }
      }
    }
  }

  for (const whitelistedPair of config.whitelistPairs ?? []) {
    pairByKey.set(`${whitelistedPair.general}::${whitelistedPair.feminine}`, whitelistedPair);
  }

  const blacklist = new Set((config.blacklistCategories ?? []).map(normalizeCategoryName));

  return [...pairByKey.values()].filter((pair) => !blacklist.has(pair.general) && !blacklist.has(pair.feminine));
}

export default async function genderedCategorySyncModel(
  apiInstance?: IWikiApi,
  wikidataInstance?: IWikiDataAPI,
  userConfig: GenderedCategorySyncConfig = {},
): Promise<SyncReport> {
  const api = apiInstance ?? WikiApi();
  const wikidataApi = wikidataInstance ?? WikiDataAPI();
  const config: Required<Pick<GenderedCategorySyncConfig, 'dryRun' | 'editSummary' | 'maxCategoryMembers'>> = {
    dryRun: userConfig.dryRun ?? true,
    editSummary: userConfig.editSummary ?? 'סנכרון קטגוריות אישים כלליות/נשיות',
    maxCategoryMembers: userConfig.maxCategoryMembers ?? 500,
  };

  await api.login();
  await wikidataApi.login();

  const candidatePairs = await discoverPairs(api, userConfig);

  const validPairs: CategoryPair[] = [];
  const skippedPairs: Array<{ pair: CategoryPair; reason: string }> = [];

  for (const pair of candidatePairs) {
    const validation = await validatePair(api, pair);
    if (validation.valid) {
      validPairs.push(pair);
    } else {
      skippedPairs.push({ pair, reason: validation.reason ?? 'unknown' });
    }
  }

  const planned = new Map<string, PlannedPageChange>();

  function upsertPlannedChange(
    pageTitle: string,
    categoryToAdd: string,
    rule: string,
    genderAutoDetected: boolean,
  ) {
    const existing = planned.get(pageTitle);
    if (existing) {
      if (!existing.categoriesAdded.includes(categoryToAdd)) {
        existing.categoriesAdded.push(categoryToAdd);
      }
      if (!existing.matchingRules.includes(rule)) {
        existing.matchingRules.push(rule);
      }
      existing.genderAutoDetected = existing.genderAutoDetected || genderAutoDetected;
      return;
    }

    planned.set(pageTitle, {
      pageTitle,
      categoriesAdded: [categoryToAdd],
      matchingRules: [rule],
      genderAutoDetected,
    });
  }

  const feminineCategorySet = new Set(validPairs.map((p) => p.feminine));

  for (const pair of validPairs) {
    for await (const batch of api.categroyPages(pair.feminine, config.maxCategoryMembers)) {
      for (const page of batch) {
        const title = page.title;
        const pageState = await fetchPageState(api, title, page);
        const categories = new Set(parseCategories(pageState.content).map((c) => c.name));
        if (!categories.has(pair.general)) {
          upsertPlannedChange(title, pair.general, pair.rule, false);
        }
      }
    }

    for await (const batch of api.categroyPages(pair.general, config.maxCategoryMembers)) {
      for (const page of batch) {
        const title = page.title;
        const pageState = await fetchPageState(api, title, page);
        const categories = new Set(parseCategories(pageState.content).map((c) => c.name));

        if (categories.has(pair.feminine)) continue;

        const gender = await detectFemale(api, wikidataApi, title, pageState.content, feminineCategorySet);
        if (!gender.female) continue;

        upsertPlannedChange(title, pair.feminine, pair.rule, gender.autoDetected);
      }
    }
  }

  const plannedChanges = [...planned.values()].sort((a, b) => a.pageTitle.localeCompare(b.pageTitle, 'he'));

  if (!config.dryRun) {
    for (const plan of plannedChanges) {
      const { content, revid } = await api.articleContent(plan.pageTitle);
      const relevantPairs = validPairs.filter((pair) => plan.categoriesAdded.includes(pair.general)
        || plan.categoriesAdded.includes(pair.feminine)
        || parseCategories(content).some((category) => category.name === pair.general || category.name === pair.feminine));
      const next = applyCategoryChanges(content, plan.categoriesAdded, relevantPairs);
      if (!next.changed) continue;
      await api.edit(plan.pageTitle, config.editSummary, next.content, revid);
    }
  }

  return {
    dryRun: config.dryRun,
    pairsProcessed: validPairs.length,
    pagesChanged: plannedChanges.length,
    plannedChanges,
    skippedPairs,
  };
}
