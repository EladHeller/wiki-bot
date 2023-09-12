import 'dotenv/config';
import haaretzDates from '../scripts/oneTime/templatesDates/haaretzDates';

async function main() {
  await haaretzDates();
}

main();
