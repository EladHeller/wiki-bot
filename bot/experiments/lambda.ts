import 'dotenv/config';
import WikiApi from '../wiki/WikiApi';

export async function main() {
  const api = WikiApi();
  await api.login();
  const { content } = await api.articleContent('שיחת משתמש:החבלן/test');
  console.log(content);
}

export default main;
