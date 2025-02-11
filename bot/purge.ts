/* eslint-disable import/prefer-default-export */
import 'dotenv/config';
import shabathProtectorDecorator from './decorators/shabathProtector';
import NewWikiApi from './wiki/NewWikiApi';

async function purgeBot() {
  const api = NewWikiApi();
  await api.login();
  console.log('Login success');
  const today = new Date().toLocaleString('he', { month: 'long', day: 'numeric' });
  const { content } = await api.articleContent(today);
  if (!content) {
    return;
  }
  const start = content.includes('==נולדו==') ? content.indexOf('==נולדו==') : content.indexOf('== נולדו ==');
  let birthContent = content.slice(start + 2);
  birthContent = birthContent.slice(birthContent.indexOf('==') + 2);
  const nextSection = birthContent.indexOf('==');
  birthContent = birthContent.slice(0, nextSection);
  const lines = birthContent.split('\n');
  const relevent = lines.filter((line) => line.startsWith('* [[') && !line.includes('נפטר'));
  const articles = relevent
    .map((line) => line.match(/\* \[\[\d{4}\]\] – \[\[([^\]]+)\]\]/)?.[1])
    .filter((x) => x != null) as string[];
  await api.purge(articles);
}

export const main = shabathProtectorDecorator(purgeBot);
