import { asyncGeneratorMapWithSequence } from '../utilities';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import WikiDataAPI, { IWikiDataAPI } from '../wiki/WikidataAPI';

const TEMPLATE_NAME = 'מיון';
const TAXON_RANK_PROPERTY = 'P105';
const TAXON_NAME_PROPERTY = 'P225';
const REGEX = /(?:\[\[)?שם מדעי(?:\]\])?:\s*(?<name>(?:'*\w+(?:\w+)'*[, או]*)+)/;

const TAXON_FROM_GENUS_DOWN = {
  Q34740: 'genus',
  Q3238261: 'subgenus',
  Q3181348: 'section',
  Q7432: 'species',
  Q68947: 'subspecies',
  Q767728: 'variety',
  Q855769: 'strain',
  Q112082101: 'ichnogenus',
};

const TAXON_ABOVE_GENUS = {
  Q35409: 'family',
  Q227936: 'tribe',
  Q3965313: 'subtribe',
  Q164280: 'subfamily',
  Q2136103: 'superfamily',
  Q36602: 'order',
  Q5867959: 'suborder',
  Q5868144: 'superorder',
  Q2889003: 'infraorder',
  Q37517: 'class',
  Q5867051: 'subclass',
  Q2007442: 'infraclass',
  Q3504061: 'superclass',
  Q38348: 'phylum',
  Q1153785: 'subphylum',
  Q2111790: 'superphylum',
  Q2361851: 'infraphylum',
  Q36732: 'kingdom',
  Q2752679: 'subkingdom',
  Q19858692: 'superkingdom',
  Q6311258: 'parvorder',
  Q713623: 'clade',
  Q146481: 'domain',
  Q334460: 'devision',
  Q3491997: 'subdivision',
  Q3150876: 'infrakingdom',
  Q23759835: 'infradivision',
  Q6462265: 'grandorder',
  Q7506274: 'mirorder',
  Q6054237: 'magnorder',
  Q3491996: 'subdomain',
  Q10296147: 'epifamily',
};

export async function handlePage(
  title: string,
  content:string,
  revid: number,
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
) {
  const logs: string[] = [];
  try {
    const containsBinomialNomenclature = content.match(REGEX);
    const binomialNomenclatureText = containsBinomialNomenclature?.[0];
    const names = containsBinomialNomenclature?.groups?.name?.split(/[,או]/)
      ?.map((name) => name.trim())
      .filter((name) => name);
    if (!binomialNomenclatureText || !names || !names.length) {
      logs.push(`* [[${title}]]: Binomial nomenclature not found`);
      return { logs };
    }
    const wikiDataItem = await api.getWikiDataItem(title);
    if (!wikiDataItem) {
      logs.push(`* [[${title}]]: No WikiData item`);
      return { logs };
    }
    const taxonRankClaim = await wikiDataApi.getClaim(wikiDataItem, TAXON_RANK_PROPERTY);
    const taxonRankId = taxonRankClaim[0]?.mainsnak?.datavalue?.value?.id;
    if (!taxonRankId) {
      logs.push(`* [[${title}]]: No taxon rank in WikiData`);
      return { logs };
    }
    const taxonNameClaim = await wikiDataApi.getClaim(wikiDataItem, TAXON_NAME_PROPERTY);
    const taxonNames = taxonNameClaim?.map((claim) => claim?.mainsnak?.datavalue?.value);
    const taxonNamesInArticle = names.filter((name) => {
      const bareName = name.replace(/'/g, '');
      return taxonNames.includes(bareName);
    });
    if (taxonNamesInArticle.length === 0) {
      logs.push(`* [[${title}]]: Taxon names in article (${names.join(', ')}) not matching WikiData taxon names (${taxonNames.join(', ')})`);
      return { logs };
    }
    const startAndEndNotMatched = taxonNamesInArticle.filter((name) => {
      const match = name.match(/^(?<start>'*)[^']*(?<end>'*)$/);
      return match?.groups?.start !== match?.groups?.end;
    });
    if (startAndEndNotMatched.length > 0) {
      logs.push(`* [[${title}]]: Taxon names in article start and end not matched (${startAndEndNotMatched.join(', ')})`);
      return { logs };
    }
    let newContent = content;
    let newBinomialNomenclatureText = binomialNomenclatureText;
    if (taxonRankId in TAXON_FROM_GENUS_DOWN && taxonNamesInArticle.some((name) => !name.match(/^''[^']+''$/))) {
      taxonNamesInArticle.forEach((name) => {
        const newName = `''${name.replace(/'/g, '')}''`;
        const newText = newBinomialNomenclatureText.replace(name, newName);
        newContent = newContent.replace(newBinomialNomenclatureText, newText);
        newBinomialNomenclatureText = newText;
        logs.push(`* [[${title}]]: Taxon rank (${taxonRankId}) is from genus down, adding quotes to ${name}`);
      });
    }
    if (taxonRankId in TAXON_ABOVE_GENUS && taxonNamesInArticle.some((name) => name.includes("'"))) {
      taxonNamesInArticle.forEach((name) => {
        const newName = name.replace(/'/g, '');
        const newText = newBinomialNomenclatureText.replace(name, newName);
        newContent = newContent.replace(newBinomialNomenclatureText, newText);
        newBinomialNomenclatureText = newText;
        logs.push(`* [[${title}]]: Taxon rank (${taxonRankId}) is above genus, removing quotes from ${name}`);
      });
    }
    if (!(taxonRankId in TAXON_FROM_GENUS_DOWN) && !(taxonRankId in TAXON_ABOVE_GENUS)) {
      console.log(`Taxon rank ${title} isn't known`, { taxonRankId });
      logs.push(`* [[${title}]]: Taxon rank (${taxonRankId}) isn't known`);
      return { logs };
    }
    if (newContent === content) {
      return { logs };
    }
    console.log(`Updating ${title}...`);
    const link = '[[ויקיפדיה:מדריך לעיצוב ערכים/בעלי חיים#הטיית שמות מרמת הסוג ומטה|דף המדיניות]]';
    await api.edit(title, `תיקון שם מדעי על פי ${link}`, newContent, revid);
    return { logs, edited: true };
  } catch (error) {
    //   console.error(`Error processing ${title}:`, error);
    logs.push(`* [[${title}]]: ${error.message || error}`);
  }
  return { logs };
}

export default async function taxonBinomialNomenclatureFormat() {
  const api = WikiApi();
  await api.login();
  const wikiDataApi = WikiDataAPI();
  await wikiDataApi.login();
  const taxonBinomialNomenclature = api.getArticlesWithTemplate(TEMPLATE_NAME, { geicontinue: '0|1998512', continue: 'geicontinue||' });
  const logs: string[] = [];
  let pagesCount = 0;
  let editsCount = 0;

  try {
    await asyncGeneratorMapWithSequence(50, taxonBinomialNomenclature, (page) => async () => {
      pagesCount += 1;
      const revid = page.revisions?.[0].revid;
      const content = page.revisions?.[0].slots.main['*'];
      if (!revid || !content) {
        console.log(`No revid or content for ${page.title}`, { revid: !!revid, content: !!content });
        logs.push(`* [[${page.title}]]: No revid or content`);
        return;
      }
      const pageResults = await handlePage(page.title, content, revid, api, wikiDataApi);
      if (pageResults.logs.length > 0) {
        logs.push(...pageResults.logs);
      }
      if (pageResults.edited) {
        editsCount += 1;
      }
    });
  } catch (error) {
    console.error('Error processing pages:', error);
    logs.push(`* Error processing pages: ${error.message || error}`);
  }
  logs.unshift(`נמצאו ${pagesCount} דפים עם {{תב|${TEMPLATE_NAME}}}, עודכנו ${editsCount} דפים ב-${logs.length} דפים נמצאו בעיות.\n`);

  await api.create('user:Sapper-bot/תיקון שם מדעי2', 'תיקון שם מדעי', logs.join('\n'));
}
