import 'dotenv/config';
import { main as kineret } from '../kineret/kineretBot';

async function main() {
  await kineret();
}

main();
