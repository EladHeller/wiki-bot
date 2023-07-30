import 'dotenv/config';
import { first, second, third } from '../scripts/singleAlbumDesign';

async function main() {
  await first();
  await second();
  await third();
}

main();
