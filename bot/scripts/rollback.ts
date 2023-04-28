import 'dotenv/config';
import { rollbackUserContributions, undoContributions } from '../wiki/wikiAPI';

const undo = false;
export default async function main() {
  if (undo) {
    await undoContributions('test', 'בדיקת שחזור', 2);
  } else {
    await rollbackUserContributions('test', 'בדיקת שחזור', 2);
  }
}

main().catch(console.error);
