import 'dotenv/config';
import fs from 'fs/promises';
import Company from './company';
import getMayaDetails, { MayaWithWiki } from './mayaAPI';
import {
  getData, getToken, login, updateArticle, WikiPage,
} from './wikiAPI';
import { buildTableRow } from './WikiParser';
// import {
//   getData, getToken, login,
// } from './wikiAPI';

const year = process.env.YEAR;

async function saveTable(companies: Company[]) {
  let tableRows = '';
  companies.forEach((company) => {
    const details = [company.name, ...Object.values(company.mayaDataForWiki).map((val) => val || '---')];
    details.push(company.wikiTemplateData.year);
    details.push(company.isContainsTamplate);
    tableRows += buildTableRow(details);
  });

  const tableString = `{| class="wikitable sortable"\n! שם החברה !! הכנסות !! רווח תפעולי !! רווח!!הון עצמי!!סך המאזן!!תאריך הנתונים!!מכיל [[תבנית:חברה מסחרית]]${tableRows}\n|}`;

  const res = await updateArticle(
    'משתמש:Sapper-bot/tradeBootData', 'עדכון', tableString,
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
  const logintoken = await getToken();
  await login(logintoken);

  const wikiResult = await getData();
  await fs.writeFile('./res.json', JSON.stringify(wikiResult, null, 2), 'utf8');
  const pages: WikiPage[] = Object.values(wikiResult);
  const mayaResults = await Promise.all(pages.map(getMayaDetails));
  await fs.writeFile('./maya-res.json', JSON.stringify(mayaResults, null, 2), 'utf8');

  // const mayaResults: MayaWithWiki[] = JSON.parse(await fs.readFile('./maya-res.json', 'utf8'));
  const companies = mayaResults
    .filter((x) => x != null)
    .filter(({ maya, wiki }: MayaWithWiki) => maya && wiki)
    .map(({ maya, wiki }: MayaWithWiki) => {
      const mayaDetails = new Map();
      maya.AllRows.forEach((row) => {
        mayaDetails.set(row.Name, row.CurrPeriodValue);
      });

      return new Company(wiki.title, mayaDetails, wiki, maya.CurrentPeriod.Year);
    });

  await saveTable(companies);

  const relevantCompanies = getRelevantCompanies(companies);
  console.log(relevantCompanies.length);
  relevantCompanies.forEach((company) => company.updateCompanyArticle());
}

main().catch(console.error);
