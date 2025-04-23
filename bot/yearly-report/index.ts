import Company from './company';
import { getFinanceReport } from '../API/mayaAPI';
import { WikiPage } from '../types';
import { buildTable } from '../wiki/wikiTableParser';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import { companiesWithMayaId } from '../wiki/WikiDataSqlQueries';
import { querySparql } from '../wiki/WikidataAPI';
// https://market.tase.co.il/he/market_data/company/1691/financial_reports
// https://market.tase.co.il/he/market_data/company/1480/financial_reports

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

  const headers = ['קישור', 'שם החברה', 'הכנסות', 'רווח תפעולי', 'רווח', 'הון עצמי', 'סך המאזן', 'מטבע', 'תאריך הנתונים', 'מכיל [[תבנית:חברה מסחרית]]', 'עריכה אחרונה', 'גודל ביצירה', 'גודל נוכחי'];
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

  const query = companiesWithMayaId();
  const results = await querySparql(query);
  const companies: Company[] = [];
  for (const result of results) {
    const maya = await getFinanceReport(result.mayaId);
    const wikiContent = await api.articleContent(result.articleName);
    const w: WikiPage = {
      title: result.articleName,
      pageid: 0,
      extlinks: [],
      ns: 0,
      revisions: [{
        revid: wikiContent.revid,
        user: '',
        timestamp: '',
        size: wikiContent.content.length,
        slots: {
          main: {
            contentmodel: '',
            contentformat: '',
            '*': wikiContent.content,
          },
        },
      }],
    };
    if (!maya) {
      console.error(`no maya data ${result.articleName}`);
    }
    if (!wikiContent) {
      console.error(`no wiki content ${result.articleName}`);
    }

    if (maya && !maya.CurrencyName) {
      console.error(`no currency ${result.articleName}`);
    }

    if (maya && wikiContent && maya.CurrencyName) {
      const company = new Company(
        result.articleName,
        maya,
        w,
        result.mayaId,
        api,
        year,
      );
      companies.push(company);

      const isRelevantForUpdate = company.newArticleText
        && (company.wikiTemplateData.year?.toString() === year)
        && company.hasData
        && company.newArticleText !== company.articleText;
      if (isRelevantForUpdate) {
        console.log(`updating ${company.name}`);
        await company.updateCompanyArticle();
      } else {
        console.log(`not updating ${company.name}`);
      }
    }
  }

  console.log(companies.length);
  await saveTable(api, companies);

  const relevantCompanies = getRelevantCompanies(companies, year);
  console.log(relevantCompanies.length);
}
