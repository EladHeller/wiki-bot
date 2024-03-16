import 'dotenv/config';
import checkCopyViolations from '../API/copyvios';

// eslint-disable-next-line no-empty-function
async function main() {
  const res = await checkCopyViolations('30', 'he', 'https://www.hamichlol.org.il/30');
  console.log(res);
}

main();
