import 'dotenv/config';
import haaretzDates from '../scripts/oneTime/templatesDates/haaretzDates';
import pagesWithoutProtectInMainPage from '../admin/pagesWithoutProtectInMainPage';

async function main() {
  const res = await pagesWithoutProtectInMainPage();
  console.log(res);
}

main();
