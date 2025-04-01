import fs from 'fs/promises';
import Company from './company';
import { getFinanceReport, MayaCompany } from '../API/mayaAPI';
import { WikiPage } from '../types';
import { buildTable } from '../wiki/wikiTableParser';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import { getMayaCompanies, getMayaCompanyIdFromWikiPage } from '../wiki/SharedWikiApiFunctions';

type MayaWithWiki = {
  maya: MayaCompany;
  wiki: WikiPage;
  companyId: string;
};

const TABLE_PAGE = 'משתמש:Sapper-bot/tradeBootData';

async function saveTable(api: IWikiApi, companies: Company[]) {
  const tableRows: string[][] = [];

  for (const company of companies) {
    console.log(company.name);
    const revisions = await api.getArticleRevisions(company.name, 1, 'user|size');
    const firstRevision = revisions?.[0];
    if (!firstRevision) {
      throw new Error(`No revision for ${company.name}`);
    }
    const details = [`[${company.reference}]`, `[[${company.name}]]`, ...Object.values(company.mayaDataForWiki).map((val) => val || '---')];
    details.push(company.currency);
    details.push(company.wikiTemplateData.year);
    details.push(company.isContainsTemplate);
    details.push(`[[משתמש:${firstRevision.user}|${firstRevision.user}]]`, firstRevision.size);
    details.push(company.revisionSize);
    tableRows.push(details);
  }

  const headers = ['קישור', 'שם החברה', 'הכנסות', 'רווח תפעולי', 'רווח', 'הון עצמי', 'סך המאזן', 'מטבע', 'תאריך הנתונים', 'מכיל [[תבנית:חברה מסחרית]]', 'משתמש יוצר', 'גודל ביצירה', 'גודל נוכחי'];
  const tableText = buildTable(headers, tableRows);
  const tableRevision = await api.getArticleRevisions(TABLE_PAGE, 1, 'ids');
  const revid = tableRevision[0]?.revid;
  if (!revid) {
    throw new Error('No revid for table');
  }
  const res = await api.edit(
    TABLE_PAGE,
    'עדכון',
    tableText,
    revid,
  );
  console.log(res);
}

function getRelevantCompanies(companies: Company[], year: string) {
  return companies.filter((company) => company.newArticleText
    && (company.wikiTemplateData.year?.toString() === year)
    && company.hasData
    && company.newArticleText !== company.articleText);
}

export default async function yearlyReport(year: string) {
  const api = WikiApi();
  await api.login();
  console.log('Login success');

  const wikiResult = await getMayaCompanies(api);
  await fs.writeFile('./res.json', JSON.stringify(wikiResult, null, 2), 'utf8');
  const pages: WikiPage[] = Object.values(wikiResult);
  // const pages: WikiPage[] = Object.values(JSON.parse(await fs.readFile('./res.json', 'utf-8')));

  const mayaResults: MayaWithWiki[] = [];
  for (const page of pages) {
    const companyId = getMayaCompanyIdFromWikiPage(page);
    if (!companyId) {
      console.error(`no maya id ${page.title}`);
    } else {
      const companyReport = await getFinanceReport(companyId);
      if (companyReport) {
        console.log(`success ${page.title}`);
        mayaResults.push({
          companyId,
          wiki: page,
          maya: companyReport,
        });
      }
    }
  }
  await fs.writeFile('./maya-res.json', JSON.stringify(mayaResults, null, 2), 'utf8');

  // const mayaResults: MayaWithWiki[] = JSON.parse(await fs.readFile('./maya-res.json', 'utf8'));
  console.log('get data success');
  console.log(mayaResults.length);
  const companies = mayaResults
    .filter((x) => x != null && x.maya && x.wiki && x.maya.CurrencyName != null)
    .filter(({ maya, wiki }: MayaWithWiki) => maya && wiki)
    .map(({ maya, wiki, companyId }: MayaWithWiki) => new Company(
      wiki.title,
      maya,
      wiki,
      companyId,
      api,
    ));
  console.log(companies.length);
  await saveTable(api, companies);

  const relevantCompanies = getRelevantCompanies(companies, year);
  console.log(relevantCompanies.length);
  for (let i = 0; i < relevantCompanies.length; i += 1) {
    await relevantCompanies[i].updateCompanyArticle();
  }
}
