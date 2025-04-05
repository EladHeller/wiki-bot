import shabathProtectorDecorator from './decorators/shabathProtector';
import WikiApi, { IWikiApi } from './wiki/WikiApi';
import { querySparql } from './wiki/WikidataAPI';
import { personWithBirthdayInDay } from './wiki/WikiDataSqlQueries';

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
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const query = personWithBirthdayInDay(day, month);
  const results = await querySparql(query);
  return results.map((person) => decodeURIComponent(person.hebrewArticle.replace('https://he.wikipedia.org/wiki/', '')).replace(/_/g, ' '));
}
export default async function purgeBot() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');
  const wikipediaArticles = await getWikipediaBirthdays(api);
  const wikiDataArticles = await getWikiDataArticles();
  const articles = new Set([...wikipediaArticles, ...wikiDataArticles]);
  console.log(await api.purge([...articles]));
}

export const main = shabathProtectorDecorator(purgeBot);
