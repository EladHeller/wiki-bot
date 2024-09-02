import 'dotenv/config';
import NewWikiApi from '../wiki/NewWikiApi';

export async function main() {
  const api = NewWikiApi();
  try {
    await api.login();
    await api.protect('תבנית:דגל/שימאנה (מחוז)', '', 'never', 'באג של ויקיפדיה');
    await api.protect('תבנית:דגל/שימאנה (מחוז)', 'edit=editautopatrolprotected|move=editautopatrolprotected', 'never', 'תבנית דגל: בשימוש רב');
    console.log('Done');
  } catch (e) {
    console.error(e);
  }
}

export default main;
