import 'dotenv/config';
import globesDates from '../scripts/oneTime/templatesDates/globesDates';

async function main() {
  await globesDates();
}

main();
