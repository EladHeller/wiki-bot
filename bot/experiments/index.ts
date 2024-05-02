import 'dotenv/config';
import copyrightViolationBot from '../maintenance/copyrightViolation';

// eslint-disable-next-line no-empty-function
async function main() {
  await copyrightViolationBot();
}
main();
