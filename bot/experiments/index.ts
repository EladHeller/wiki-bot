import 'dotenv/config';
import NewWikiApi from '../wiki/NewWikiApi';
import BaseWikiApi from '../wiki/BaseWikiApi';

async function main() {
  const wikipediaApi = NewWikiApi({
    baseUrl: 'https://he.wikipedia.org/w/api.php',
  });

  const wikidataApi = BaseWikiApi({
    baseUrl: 'https://www.wikidata.org/w/api.php',
    assertBot: false,
  });
  await wikidataApi.login();

  const wikidataItem = await wikipediaApi.getWikiDataItem('18 ביולי');
  console.log(wikidataItem);
}

main();
