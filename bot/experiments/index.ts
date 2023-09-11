import 'dotenv/config';
import { main as kineretBot } from '../kineret/kineretBot';

async function main() {
  await kineretBot();
}

main();
