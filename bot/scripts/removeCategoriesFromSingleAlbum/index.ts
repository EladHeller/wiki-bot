import model from './model';
import WikiApi from '../../wiki/WikiApi';
import WikiDataAPI from '../../wiki/WikidataAPI';

export default async function main() {
  const api = WikiApi();
  await api.login();
  const wikiDataApi = WikiDataAPI();
  await wikiDataApi.login();
  const logs = await model(api, wikiDataApi);
  console.log(logs);
}
