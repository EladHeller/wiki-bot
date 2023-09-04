import 'dotenv/config';
import beshevaToInn from '../scripts/oneTime/beshevaToInn';

async function main() {
  await beshevaToInn();
}

main();
