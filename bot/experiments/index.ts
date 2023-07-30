import 'dotenv/config';
import { companyDetailsBot } from '../scripts/companyDetailsBot';

async function main() {
  await companyDetailsBot();
}

main();
