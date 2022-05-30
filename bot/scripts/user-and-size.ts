import 'dotenv/config';
import fs from 'fs/promises';
import {
  getArticleContent,
  getCompanies, getCompany, getToken, login, updateArticle, WikiPage,
} from '../wikiAPI';
import { buildTableRow } from '../WikiParser';
import parseTableText from '../wikiTableParser';

type Revision = {first: Record<string, WikiPage>, latest: WikiPage};
async function main() {
  const logintoken = await getToken();
  await login(logintoken);
  console.log('Login success');

  const wikiResult = await getCompanies();

  const companies = Object.values(wikiResult);

  const revisions: Revision[] = [];
  console.log(companies.length);
  let a = 0;
  for (const company of companies) {
    revisions.push({
      first: await getCompany(company.title),
      latest: company,
    });
    console.log(company.title, a += 1);
  }
  await fs.writeFile('./res.json', JSON.stringify(revisions, null, 2), 'utf8');

  const tableText = await getArticleContent('משתמש:Sapper-bot/tradeBootData');
  if (!tableText) {
    throw new Error('Failed');
  }
  const wikitable = parseTableText(tableText);
  await fs.writeFile('./table.json', JSON.stringify(wikitable, null, 2), 'utf8');
  // const wikitable: TableData[] = JSON.parse(await fs.readFile('./table.json', 'utf-8'));
  const [table] = wikitable;
  table.rows[0].values.push('משתמש יוצר', 'גודל ביצירה', 'גודל נוכחי');
  const firstRow = table.rows.shift();
  const rows = table.rows.map((row) => {
    const name = row.values[1].replace(/[[\]]/g, '');
    const revision = revisions.find((rev) => rev.latest.title === name);
    if (revision) {
      const firstRevision = Object.values(revision.first)[0].revisions[0];
      row.values.push(`[[משתמש:${firstRevision.user}|${firstRevision.user}]]`, `${firstRevision.size}`, `${revision.latest.revisions[0].size}`);
      return row;
    }
    return row;
  });
  await fs.writeFile('./row-res.json', JSON.stringify(rows, null, 2), 'utf8');
  const res = `${rows.reduce(
    (acc, row) => acc + buildTableRow(row.values),
    `{| class="wikitable sortable"\n! ${firstRow!.values.join(' !! ')}`,
  )}\n|}`;
  const updateREs = await updateArticle(
    'משתמש:Sapper-bot/tradeBootData',
    'עדכון',
    res,
  );
  console.log(updateREs);
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
