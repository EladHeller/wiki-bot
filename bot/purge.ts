import 'dotenv/config';
import shabathProtectorDecorator from './decorators/shabathProtector';
import NewWikiApi, { IWikiApi } from './wiki/NewWikiApi';
import WikiDataAPI from './wiki/WikidataAPI';

function getWikiDataQuery(month: number, day: number) {
  return `SELECT ?person ?personLabel ?birthDate ?hebrewArticle WHERE {
    ?person wdt:P31 wd:Q5;  # Instance of human
            wdt:P569 ?birthDate.  # Birthdate
            
    FILTER(MONTH(?birthDate) = ${month} && DAY(?birthDate) = ${day})  # Change to your date
    
    FILTER NOT EXISTS { ?person wdt:P570 ?deathDate }  # Exclude deceased people
  
    ?hebrewArticle schema:about ?person;
                   schema:isPartOf <https://he.wikipedia.org/>.
    
    SERVICE wikibase:label { bd:serviceParam wikibase:language "he". }
  }
  `;
}

async function getWikipediaBirthdays(api: IWikiApi): Promise<string[]> {
  const today = new Date().toLocaleString('he', { month: 'long', day: 'numeric' });
  const { content } = await api.articleContent(today);
  if (!content) {
    return [];
  }
  const start = content.includes('==נולדו==') ? content.indexOf('==נולדו==') : content.indexOf('== נולדו ==');
  let birthContent = content.slice(start + 2);
  birthContent = birthContent.slice(birthContent.indexOf('==') + 2);
  const nextSection = birthContent.indexOf('==');
  birthContent = birthContent.slice(0, nextSection);
  const lines = birthContent.split('\n');
  const relevent = lines.filter((line) => line.startsWith('* [[') && !line.includes('נפטר'));
  const articles = relevent
    .map((line) => line.match(/\* \[\[\d{4}\]\] – \[\[([^\]]+)\]\]/)?.[1]?.split('|')?.[0])
    .filter((x) => x != null);
  return articles;
}

async function getWikiDataArticles() {
  const wikiDataApi = WikiDataAPI();
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const query = getWikiDataQuery(month, day);
  const result = await wikiDataApi.querySql(query);
  return result.results.bindings.map((binding) => decodeURIComponent(binding.hebrewArticle.value.replace('https://he.wikipedia.org/wiki/', '')).replace(/_/g, ' '));
}
export default async function purgeBot() {
  const api = NewWikiApi();
  await api.login();
  console.log('Login success');
  const wikipediaArticles = await getWikipediaBirthdays(api);
  const wikiDataArticles = await getWikiDataArticles();
  const articles = new Set([...wikipediaArticles, ...wikiDataArticles]);
  console.log(await api.purge([...articles]));
}

export const main = shabathProtectorDecorator(purgeBot);
