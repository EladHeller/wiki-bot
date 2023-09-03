import 'dotenv/config';
import haaretzDates from '../scripts/oneTime/haaretzDates';

async function main() {
  await haaretzDates();
}

main();
