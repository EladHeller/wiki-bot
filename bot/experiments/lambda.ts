import 'dotenv/config';
import NewWikiApi from '../wiki/NewWikiApi';

export async function main() {
  const api = NewWikiApi();
  await api.login();
  const { content } = await api.articleContent('שיחת משתמש:החבלן/test');
  console.log(content);
}

export default main;
