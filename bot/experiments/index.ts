import 'dotenv/config';
import { login, protect } from '../wiki/wikiAPI';

async function main() {
  await login();
  // const res = await protect('user:החבלן/test', 'edit=autopatrolled', 'never', 'בדיקת הבוט');
  const res = await protect('user:החבלן/test', 'edit=editautopatrolprotected|move=editautopatrolprotected', 'never', 'בדיקת הבוט');
  console.log(JSON.stringify(res, null, 2));
}

main();
