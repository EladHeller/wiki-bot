import 'dotenv/config';
import deleteBot from '../admin/deleteRedirects';

// eslint-disable-next-line no-empty-function
async function main() {
  await deleteBot();
}
main();
