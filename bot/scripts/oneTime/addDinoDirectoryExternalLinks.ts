import { getParagraphContent } from '../../wiki/paragraphParser';
import { findTemplate } from '../../wiki/newTemplateParser';
import { getInnerLinks } from '../../wiki/wikiLinkParser';
import { getRedirectTargetFromContent } from '../../wiki/redirectParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import WikiDataAPI, { IWikiDataAPI } from '../../wiki/WikidataAPI';

const SOURCE_PAGE = 'משתמש:יהודה אמיר/דינוזאורים';
const TEMPLATE_NAME = 'DinoDirectory';
const TAXON_NAME_PROPERTY = 'P225';
const TAXON_RANK_PROPERTY = 'P105';
const PARENT_TAXON_PROPERTY = 'P171';
const GENUS_TAXON_RANK = 'Q34740';
const SPECIES_TAXON_RANK = 'Q7432';
const AUTHORITY_CONTROL_TEMPLATE = 'בקרת זהויות';
const STUB_TEMPLATE = 'קצרמר';
const EXTERNAL_LINKS_HEADING = 'קישורים חיצוניים';
const EXPLANATIONS_HEADING = 'ביאורים';
const REFERENCES_HEADING = 'הערות שוליים';
const START_FROM_ARTICLE = '';
const DINO_DIRECTORY_BASE_URL = 'https://www.nhm.ac.uk/discover/dino-directory';

const SKIP_LINK_PREFIXES = ['קטגוריה:', 'תבנית:', 'קובץ:', 'ויקישיתוף:', 'משתמש:', 'ויקיפדיה:', 'שיחה:', 'מדיה:'];

function getInsertionAnchorIndex(articleText: string): number | null {
  const explanationsHeadingRegex = new RegExp(`^\\s*==\\s*${EXPLANATIONS_HEADING}\\s*==\\s*$`, 'm');
  const referencesHeadingRegex = new RegExp(`^\\s*==\\s*${REFERENCES_HEADING}\\s*==\\s*$`, 'm');
  const categoriesRegex = /^\s*\[\[\s*קטגוריה\s*:/m;

  const explanationsMatch = articleText.match(explanationsHeadingRegex);
  const referencesMatch = articleText.match(referencesHeadingRegex);
  const categoriesMatch = articleText.match(categoriesRegex);
  const authorityControlTemplate = findTemplate(articleText, AUTHORITY_CONTROL_TEMPLATE, 'article');
  const authorityControlIndex = authorityControlTemplate
    ? articleText.indexOf(authorityControlTemplate)
    : -1;
  const stubTemplate = findTemplate(articleText, STUB_TEMPLATE, 'article');
  const stubIndex = stubTemplate
    ? articleText.indexOf(stubTemplate)
    : -1;

  const candidateIndexes = [
    explanationsMatch?.index,
    referencesMatch?.index,
    categoriesMatch?.index,
    authorityControlIndex > -1 ? authorityControlIndex : undefined,
    stubIndex > -1 ? stubIndex : undefined,
  ]
    .filter((index): index is number => index != null)
    .sort((a, b) => a - b);

  return candidateIndexes.length > 0 ? candidateIndexes[0] : null;
}

function insertExternalLinksSection(articleText: string, template: string): string {
  const insertBlock = `\n== ${EXTERNAL_LINKS_HEADING} ==\n* ${template}\n`;
  const insertIndex = getInsertionAnchorIndex(articleText);
  if (insertIndex != null) {
    const before = articleText.slice(0, insertIndex).replace(/\s*$/, '\n');
    const after = articleText.slice(insertIndex).replace(/^\s*/, '');
    return `${before}${insertBlock}\n${after}`;
  }

  return `${articleText.replace(/\s*$/, '')}${insertBlock}`;
}

function hasDinoDirectoryTemplate(text: string): boolean {
  return findTemplate(text, TEMPLATE_NAME, 'external-links-section') !== '';
}

function addTemplateToExternalLinksSection(articleText: string, template: string, title: string): string {
  const sectionWithTitle = getParagraphContent(articleText, EXTERNAL_LINKS_HEADING, title, true);
  if (!sectionWithTitle) {
    return insertExternalLinksSection(articleText, template);
  }

  if (hasDinoDirectoryTemplate(sectionWithTitle)) {
    return articleText;
  }

  const templateLine = `* ${template}\n`;
  const authorityControlInSection = findTemplate(sectionWithTitle, AUTHORITY_CONTROL_TEMPLATE, title);
  const authorityControlIndex = authorityControlInSection
    ? sectionWithTitle.indexOf(authorityControlInSection)
    : -1;
  const categoriesMatch = sectionWithTitle.match(/^\s*\[\[\s*קטגוריה\s*:/m);
  const insertIndexCandidates = [
    authorityControlIndex > -1 ? authorityControlIndex : undefined,
    categoriesMatch?.index,
  ].filter((index): index is number => index != null).sort((a, b) => a - b);

  const updatedSection = insertIndexCandidates.length > 0
    ? `${sectionWithTitle.slice(0, insertIndexCandidates[0]).replace(/\s*$/, '\n')}${templateLine}${sectionWithTitle.slice(insertIndexCandidates[0]).replace(/^\s*/, '')}`
    : `${sectionWithTitle.replace(/\s*$/, '')}\n${templateLine}`;
  return articleText.replace(sectionWithTitle, updatedSection);
}

function buildDinoDirectoryTemplate(taxonName: string): string {
  return `{{${TEMPLATE_NAME}|${taxonName}}}`;
}

function getArticleTitlesFromSourcePage(content: string): string[] {
  const links = getInnerLinks(content);
  const titles = links
    .map(({ link }) => link.trim())
    .filter((link) => link && !SKIP_LINK_PREFIXES.some((prefix) => link.startsWith(prefix)));

  return [...new Set(titles)];
}

async function getTaxonRankId(wikiDataApi: IWikiDataAPI, qid: string): Promise<string | undefined> {
  const claims = await wikiDataApi.getClaim(qid, TAXON_RANK_PROPERTY);
  return claims?.[0]?.mainsnak?.datavalue?.value?.id;
}

async function getParentTaxonQid(wikiDataApi: IWikiDataAPI, qid: string): Promise<string | null> {
  const claims = await wikiDataApi.getClaim(qid, PARENT_TAXON_PROPERTY);
  const parentQid = claims?.[0]?.mainsnak?.datavalue?.value?.id;
  return parentQid ?? null;
}

async function getTaxonNameFromWikidata(
  wikiDataApi: IWikiDataAPI,
  qid: string,
): Promise<string | null> {
  const claims = await wikiDataApi.getClaim(qid, TAXON_NAME_PROPERTY);
  const taxonName = claims?.[0]?.mainsnak?.datavalue?.value;
  if (typeof taxonName !== 'string' || !taxonName.trim()) {
    return null;
  }
  return taxonName.trim();
}

async function resolveGenusTaxonName(
  wikiDataApi: IWikiDataAPI,
  qid: string,
): Promise<string | null> {
  const taxonRankId = await getTaxonRankId(wikiDataApi, qid);

  if (taxonRankId === GENUS_TAXON_RANK) {
    return getTaxonNameFromWikidata(wikiDataApi, qid);
  }

  if (taxonRankId === SPECIES_TAXON_RANK) {
    const parentQid = await getParentTaxonQid(wikiDataApi, qid);
    if (!parentQid) {
      return null;
    }
    const parentRankId = await getTaxonRankId(wikiDataApi, parentQid);
    if (parentRankId !== GENUS_TAXON_RANK) {
      return null;
    }
    return getTaxonNameFromWikidata(wikiDataApi, parentQid);
  }

  return null;
}

async function hasDinoDirectoryArticle(taxonName: string): Promise<boolean> {
  const url = `${DINO_DIRECTORY_BASE_URL}/${taxonName}.html`;
  const response = await fetch(url);
  const html = await response.text();
  return !html.includes(`Dinosaur with name ${taxonName} not found`);
}

async function resolveRedirectTarget(
  api: IWikiApi,
  initialTitle: string,
): Promise<{ title: string; content: string; revid: number }> {
  const current = await api.articleContent(initialTitle);
  const redirectTarget = getRedirectTargetFromContent(current.content);
  if (!redirectTarget) {
    return {
      title: initialTitle,
      content: current.content,
      revid: current.revid,
    };
  }

  const redirected = await api.articleContent(redirectTarget);
  return {
    title: redirectTarget,
    content: redirected.content,
    revid: redirected.revid,
  };
}

type UpdateResult = 'updated' | 'skipped' | 'skippedNoTaxon' | 'skippedNotGenus' | 'skippedNoDinoDirectory' | 'failed';

async function updateArticleIfNeeded(
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  title: string,
): Promise<UpdateResult> {
  try {
    const resolved = await resolveRedirectTarget(api, title);
    const qid = await api.getWikiDataItem(resolved.title);
    if (!qid) {
      console.log(`Skipping ${resolved.title}: no Wikidata item`);
      return 'skippedNoTaxon';
    }

    const taxonRankId = await getTaxonRankId(wikiDataApi, qid);
    if (taxonRankId !== GENUS_TAXON_RANK && taxonRankId !== SPECIES_TAXON_RANK) {
      console.log(`Skipping ${resolved.title}: taxon rank is not genus or species (${qid}, P105=${taxonRankId ?? 'none'})`);
      return 'skippedNotGenus';
    }

    const taxonName = await resolveGenusTaxonName(wikiDataApi, qid);
    if (!taxonName) {
      console.log(`Skipping ${resolved.title}: could not resolve genus taxon name (${qid})`);
      return 'skippedNoTaxon';
    }

    const dinoDirectoryExists = await hasDinoDirectoryArticle(taxonName);
    if (!dinoDirectoryExists) {
      console.log(`Skipping ${resolved.title}: no DinoDirectory page for ${taxonName}`);
      return 'skippedNoDinoDirectory';
    }

    const template = buildDinoDirectoryTemplate(taxonName);
    const newContent = addTemplateToExternalLinksSection(resolved.content, template, resolved.title);

    if (newContent === resolved.content) {
      console.log(`Skipping ${resolved.title}: template already exists in ${EXTERNAL_LINKS_HEADING}`);
      return 'skipped';
    }

    await api.edit(
      resolved.title,
      `הוספת [[תבנית:${TEMPLATE_NAME}]] לפרק ${EXTERNAL_LINKS_HEADING}`,
      newContent,
      resolved.revid,
    );

    if (resolved.title !== title) {
      console.log(`Updated ${resolved.title} (redirect from ${title}) with ${template}`);
    } else {
      console.log(`Updated ${title} with ${template}`);
    }
    return 'updated';
  } catch (error) {
    console.error(`Failed to process ${title}:`, error.message || error.toString());
    return 'failed';
  }
}

export default async function addDinoDirectoryExternalLinks() {
  const api = WikiApi();
  const wikiDataApi = WikiDataAPI();
  await api.login();
  await wikiDataApi.login();

  console.log(`Loading source page: ${SOURCE_PAGE}`);
  const { content: sourceContent } = await api.articleContent(SOURCE_PAGE);
  const articleTitles = getArticleTitlesFromSourcePage(sourceContent);
  console.log(`Found ${articleTitles.length} candidate articles from source page links`);

  let updatedCount = 0;
  let skippedExistingCount = 0;
  let skippedNoTaxonCount = 0;
  let skippedNotGenusCount = 0;
  let skippedNoDinoDirectoryCount = 0;
  let failedCount = 0;
  let skippedBeforeStartCount = 0;
  let shouldProcess = !START_FROM_ARTICLE;

  for (const title of articleTitles) {
    if (!shouldProcess && title === START_FROM_ARTICLE) {
      shouldProcess = true;
      console.log(`Reached start article (${START_FROM_ARTICLE}), beginning updates`);
    }

    if (shouldProcess) {
      const result = await updateArticleIfNeeded(api, wikiDataApi, title);
      if (result === 'updated') {
        updatedCount += 1;
      } else if (result === 'skipped') {
        skippedExistingCount += 1;
      } else if (result === 'skippedNoTaxon') {
        skippedNoTaxonCount += 1;
      } else if (result === 'skippedNotGenus') {
        skippedNotGenusCount += 1;
      } else if (result === 'skippedNoDinoDirectory') {
        skippedNoDinoDirectoryCount += 1;
      } else {
        failedCount += 1;
      }
    } else {
      skippedBeforeStartCount += 1;
    }
  }

  if (!shouldProcess) {
    console.warn(`Start article not found among candidates: ${START_FROM_ARTICLE}`);
  }

  console.log('Done', {
    candidates: articleTitles.length,
    startFromArticle: START_FROM_ARTICLE,
    skippedBeforeStartCount,
    updatedCount,
    skippedExistingCount,
    skippedNoTaxonCount,
    skippedNotGenusCount,
    skippedNoDinoDirectoryCount,
    failedCount,
  });
}
