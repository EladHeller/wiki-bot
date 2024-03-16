import 'dotenv/config';
import fs from 'fs/promises';
import Company from './company';
import getMayaDetails, { MayaWithWiki } from '../API/mayaAPI.js';
import {
  getCompanies, getCompany, login, updateArticle,
} from '../wiki/wikiAPI';
import { WikiPage } from '../types';
import { buildTable } from '../wiki/wikiTableParser';

const year = process.env.YEAR;

async function saveTable(companies: Company[]) {
  const tableRows: string[][] = [];

  for (const company of companies) {
    console.log(company.name);
    const firstRevision = Object.values(await getCompany(company.name))[0].revisions[0];
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
  const res = await updateArticle(
    'משתמש:Sapper-bot/tradeBootData',
    'עדכון',
    tableText,
  );
  console.log(res);
}

function getRelevantCompanies(companies: Company[]) {
  return companies.filter((company) => company.newArticleText
    && (company.wikiTemplateData.year.toString() === year)
    && company.hasData
    && company.newArticleText !== company.articleText);
}

async function main() {
  await login();
  console.log('Login success');

  const wikiResult = await getCompanies();
  await fs.writeFile('./res.json', JSON.stringify(wikiResult, null, 2), 'utf8');
  const pages: WikiPage[] = Object.values(wikiResult);
  // const pages: WikiPage[] = Object.values(JSON.parse(await fs.readFile('./res.json', 'utf-8')));

  const mayaResults: MayaWithWiki[] = [];
  for (const page of pages) {
    const mayDetails = await getMayaDetails(page);
    if (mayDetails) {
      console.log(`success ${page.title}`);
      mayaResults.push(mayDetails);
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
    ));
  console.log(companies.length);
  await saveTable(companies);

  const relevantCompanies = getRelevantCompanies(companies);
  console.log(relevantCompanies.length);
  for (let i = 0; i < relevantCompanies.length; i += 1) {
    await relevantCompanies[i].updateCompanyArticle();
  }
}

main().catch((error) => {
  if (error?.data) {
    console.log(error?.data);
  } else if (error?.message) {
    console.log(error?.message);
  } else {
    console.log(error);
  }
  console.log(error?.toString());
});
