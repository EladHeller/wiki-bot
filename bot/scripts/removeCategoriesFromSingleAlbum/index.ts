import model from './model';
import WikiApi from '../../wiki/WikiApi';

export default async function main() {
  const api = WikiApi();
  await api.login();
  const logs = await model(api);
  console.log(logs);
}
