import fs from 'fs/promises';
import path from 'path';
import parseTableText from '../wikiTableParser';

interface UniversityRanking {
  name: string;
  rankingPerYear: Record<number, number>;
  country: string;
}

const nameAndCountryRegex = /{{דגל\|(.*)}}\[\[(.*)\]\]/;

export default async function main() {
  console.log(__dirname);
  const table = await fs.readFile(path.join(__dirname, 'template.wiki'), 'utf-8');
  const tableData = parseTableText(table)[0];
  const headRow = tableData.rows.splice(0, 1)[0];
  tableData.rows.forEach((row) => {
    const nameAndCountry = row.values.splice(0, 1)[0];
    const name = nameAndCountry.match(/.*\[\[(.*)\]\]/)?.[1];
    const country = nameAndCountry.match(/(.*)\[\[(.*)\]\]/)?.[2];
    row.values.forEach((value, index) => {
    });
    const university: UniversityRanking = {
      name: row[0],
      rankingPerYear: {
        2018: parseInt(row[1], 10),
        2019: parseInt(row[2], 10),
        2020: parseInt(row[3], 10),
      },
      country: row[4],
    };
    console.log(university);
  });
}

main().catch((err) => {
  console.error(err);
});
