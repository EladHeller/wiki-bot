import 'dotenv/config';
import wallaDates from '../scripts/oneTime/templatesDates/wallaDates';

async function main() {
  await wallaDates();
}

main();
