import 'dotenv/config';
import { login, protect } from '../wikiAPI';

async function main() {
  await login();
  const nextWeekTimeStamp = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
  const res = await protect('user:test/test', 'edit=autopatrol|move=autopatrol', nextWeekTimeStamp.toString(), 'מופיע בדף הראשי');
  console.log(res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
