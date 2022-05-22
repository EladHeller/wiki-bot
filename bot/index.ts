import 'dotenv/config';
import fs from 'fs/promises';
import Company from './company';
import getMayaDetails, { MayaMarketValue, MayaWithWiki } from './mayaAPI';
import {
  getCompanies, getToken, login, updateArticle, WikiPage,
} from './wikiAPI';
import { buildTableRow } from './WikiParser';

const year = process.env.YEAR;

async function saveTable(companies: Company[]) {
  let tableRows = '';
  companies.forEach((company) => {
    const details = [`[${company.reference}]`, `[[${company.name}]]`, ...Object.values(company.mayaDataForWiki).map((val) => val || '---')];
    details.push(company.wikiTemplateData.year);
    details.push(company.isContainsTamplate);
    tableRows += buildTableRow(details);
  });

  const tableString = `{| class="wikitable sortable"\n! קישור !! שם החברה !! הכנסות !! רווח תפעולי !! רווח!!הון עצמי!!סך המאזן!!תאריך הנתונים!!מכיל [[תבנית:חברה מסחרית]]${tableRows}\n|}`;

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
  console.log('Login success');

  const wikiResult = await getCompanies();
  await fs.writeFile('./res.json', JSON.stringify(wikiResult, null, 2), 'utf8');
  const pages: WikiPage[] = Object.values(wikiResult);
  // const pages: WikiPage[] = Object.values(JSON.parse(await fs.readFile('./res.json', 'utf-8')));

  const mayaResults: MayaWithWiki[] = [];
  for (const page of pages) {
    const res = await getMayaDetails(page);
    if (res) {
      console.log(`success ${page.title}`);
      mayaResults.push(res);
    }
  }
  await fs.writeFile('./maya-res.json', JSON.stringify(mayaResults, null, 2), 'utf8');
  const marketValues:MayaMarketValue[] = JSON.parse(await fs.readFile('./maya-markets-res.json', 'utf8'));

  // const mayaResults: MayaWithWiki[] = JSON.parse(await fs.readFile('./maya-res.json', 'utf8'));
  console.log('get data success');
  const companies = mayaResults
    .filter((x) => x != null)
    .filter(({ maya, wiki }: MayaWithWiki) => maya && wiki)
    .map(({ maya, wiki, companyId }: MayaWithWiki) => new Company(
      wiki.title, maya, wiki, companyId,
      marketValues.find(({ id }) => companyId === id)?.marketValue,
    ));

  await saveTable(companies);

  const relevantCompanies = getRelevantCompanies(companies);
  console.log(relevantCompanies.length);
  for (let i = 5; i < relevantCompanies.length; i += 1) {
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
});
