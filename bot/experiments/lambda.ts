import 'dotenv/config';
import NewWikiApi from '../wiki/NewWikiApi';

export async function main() {
  const api = NewWikiApi();
  try {
    await api.login();
    await api.create('User:SapperBot/test', 'test', 'Hello, world!');
    console.log('Done');
  } catch (e) {
    console.error(e);
  }
}

export default main;
