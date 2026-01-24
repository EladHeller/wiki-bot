import { promiseSequence } from '../../utilities';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import WikidataAPI, { IWikiDataAPI } from '../../wiki/WikidataAPI';

const PREFIX_PAIRS = [
  { male: 'בוגרי ', female: 'בוגרות ' },
  { male: 'בעלי תואר דוקטור ', female: 'בעלות תואר דוקטור ' },
];

const FEMALE_QID = 'Q6581072';
const DRY_RUN = process.env.DRY_RUN === 'true';

const requestLink = '[[מיוחד:הבדל/42578824|בקשה בוק:בב]]';

async function getGenders(wdApi: IWikiDataAPI, qids: string[]): Promise<Record<string, string>> {
  const entities = await wdApi.readEntities(qids, 'claims');

  return Object.fromEntries(
    Object.entries(entities)
      .flatMap(([qid, entity]) => {
        const p21 = entity.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id;
        return p21 ? [[qid, p21 as string]] : [];
      }),
  );
}

function addCategory(content: string, categoryName: string): string {
  const escapedCategory = categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const categoryRegex = new RegExp(`\\[\\[קטגוריה:\\s*${escapedCategory}\\s*(?:\\|[^\\]]*)?\\]\\]`, 'i');
  if (categoryRegex.test(content)) {
    return content;
  }

  // Find last category
  const lastCategoryIndex = content.lastIndexOf('[[קטגוריה:');
  if (lastCategoryIndex !== -1) {
    const endOfLastCategory = content.indexOf(']]', lastCategoryIndex);
    if (endOfLastCategory !== -1) {
      return `${content.slice(0, endOfLastCategory + 2)}\n[[קטגוריה:${categoryName}]]${content.slice(endOfLastCategory + 2)}`;
    }
  }

  // No categories found, look for another good place (after templates, before other stuff)
  // For simplicity, append at end if no categories found
  return `${content}\n[[קטגוריה:${categoryName}]]`;
}

type PageChange = { title: string; category: string };

async function getChangesForCategory(
  api: IWikiApi,
  wdApi: IWikiDataAPI,
  generalCat: string,
  femaleCat: string,
): Promise<PageChange[]> {
  console.log(`--- Discovering changes for ${generalCat} <-> ${femaleCat} ---`);

  const [femaleMembers, generalMembers] = await Promise.all([
    (async () => {
      const titles: string[] = [];
      for await (const pages of api.categroyTitles(femaleCat, 500, '0')) {
        titles.push(...pages.map((p) => p.title));
      }
      return titles;
    })(),
    (async () => {
      const titles: string[] = [];
      for await (const pages of api.categroyTitles(generalCat, 500, '0')) {
        titles.push(...pages.map((p) => p.title));
      }
      return titles;
    })(),
  ]);

  const femaleToGeneralChanges = femaleMembers.map((title) => ({ title, category: generalCat }));

  if (generalMembers.length === 0) return femaleToGeneralChanges;

  const qidMap = await api.getWikiDataItems(generalMembers);
  const genderMap = await getGenders(wdApi, Object.values(qidMap));

  const generalToFemaleChanges = generalMembers
    .filter((title) => genderMap[qidMap[title]] === FEMALE_QID)
    .map((title) => ({ title, category: femaleCat }));

  return [...femaleToGeneralChanges, ...generalToFemaleChanges];
}

async function discoverChangesForPair(
  api: IWikiApi,
  wdApi: IWikiDataAPI,
  maleCat: string,
  femaleCat: string,
  processedPairs: Set<string>,
): Promise<PageChange[]> {
  const pairId = `${maleCat}|${femaleCat}`;
  if (processedPairs.has(pairId)) return [];

  const maleTitle = `קטגוריה:${maleCat}`;
  const femaleTitle = `קטגוריה:${femaleCat}`;
  const infoResults = await api.info([maleTitle, femaleTitle]);

  const maleInfo = infoResults.find((p) => p.title?.replace(/_/g, ' ') === maleTitle.replace(/_/g, ' '));
  const femaleInfo = infoResults.find((p) => p.title?.replace(/_/g, ' ') === femaleTitle.replace(/_/g, ' '));

  if (maleInfo?.missing === undefined && femaleInfo?.missing === undefined) {
    processedPairs.add(pairId);
    return getChangesForCategory(api, wdApi, maleCat, femaleCat);
  }

  if (maleInfo?.missing !== undefined) console.warn(`Skipping pair: ${maleTitle} does not exist.`);
  if (femaleInfo?.missing !== undefined) console.warn(`Skipping pair: ${femaleTitle} does not exist.`);
  return [];
}

export default async function syncGenderCategories() {
  const api = WikiApi();
  const wdApi = WikidataAPI();
  await api.login();
  await wdApi.login();

  const processedPairs = new Set<string>();

  // 1. Discover candidates for changes
  const pairsToProcess = await promiseSequence(1, PREFIX_PAIRS.map(({ male, female }) => async () => {
    console.log(`Scanning for categories matching prefixes: "${male}" / "${female}"`);

    const discoverFromPrefix = async (prefix: string) => {
      const cats: string[] = [];
      for await (const batch of api.categoriesStartsWith(prefix)) {
        cats.push(...batch.map((c: any) => c['*']));
      }
      return cats;
    };

    const [maleCats, femaleCats] = await Promise.all([discoverFromPrefix(male), discoverFromPrefix(female)]);

    const malePairs = maleCats.map((cat) => ({ male: cat, female: cat.replace(male, female) }));
    const femalePairs = femaleCats.map((cat) => ({ male: cat.replace(female, male), female: cat }));

    return [...malePairs, ...femalePairs];
  }));

  // 2. Discover actual page changes for all identified pairs
  const flatPairs = pairsToProcess.flat();
  const discoveredChanges = await promiseSequence(1, flatPairs.map((pair) => () => discoverChangesForPair(
    api,
    wdApi,
    pair.male,
    pair.female,
    processedPairs,
  )));

  // 3. Aggregate categorical changes by page title
  const changesByPage = discoveredChanges.flat().reduce((acc, { title, category }) => {
    acc[title] = acc[title] || new Set();
    acc[title].add(category);
    return acc;
  }, {} as Record<string, Set<string>>);

  console.log(`Found ${Object.keys(changesByPage).length} pages with pending category updates.`);

  // 4. Transform accumulated changes into edit results (and execution)
  const results = await promiseSequence(10, Object.entries(changesByPage).map(([title, categories]) => async () => {
    try {
      const { content, revid } = await api.articleContent(title);

      const { newContent, added } = Array.from(categories).reduce((acc, cat) => {
        const contentBefore = acc.newContent;
        const updatedContent = addCategory(acc.newContent, cat);
        if (updatedContent !== contentBefore) {
          return {
            newContent: updatedContent,
            added: [...acc.added, cat],
          };
        }
        return acc;
      }, { newContent: content, added: [] as string[] });

      if (added.length > 0) {
        const logMsg = `Added categories: ${added.join(', ')} to [[${title}]]`;
        console.log(logMsg);
        if (!DRY_RUN) {
          await api.edit(title, `הוספת קטגוריות: ${added.join(', ')} (${requestLink})`, newContent, revid);
        }
        return `* ${logMsg}`;
      }
    } catch (e) {
      console.error(`Error applying changes to ${title}:`, (e as Error).message);
    }
    return null;
  }));

  // 5. Final Reporting
  const logs = results.filter((log): log is string => log !== null);
  const reportPage = 'משתמש:Sapper-bot/קטגוריות גברים נשים';
  const reportContent = `== דוח סנכרון קטגוריות גברים/נשים - ${new Date().toLocaleString('he-IL')} ==\n${logs.length > 0 ? logs.join('\n') : 'לא נמצאו שינויים שבוצעו.'
    }`;

  console.log(`Updating summary report at [[${reportPage}]]...`);
  const [reportInfo] = await api.info([reportPage]);
  if (!reportInfo?.lastrevid) {
    await api.create(reportPage, 'יצירת דוח סנכרון קטגוריות גברים נשים', reportContent);
  } else {
    await api.edit(reportPage, 'עדכון דוח סנכרון קטגוריות גברים נשים', reportContent, reportInfo.lastrevid!);
  }

  console.log('Gender category synchronization completed successfully.');
}
