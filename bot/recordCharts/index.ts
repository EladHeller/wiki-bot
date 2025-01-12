import shabathProtectorDecorator from '../decorators/shabathProtector';
import NewWikiApi from '../wiki/NewWikiApi';
import MediaForestBotModel from './MediaForestModel';

const defaultDataFetcher = async (url: string) => {
  console.log(`Fetching data from ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch data from ${url}`);
  }
  return res.json();
};

export default async function mdeiaForestBot() {
  console.log('Starting media forest bot');
  const model = MediaForestBotModel(NewWikiApi(), {
    baseUrl: 'https://mediaforest-group.com/',
    page: 'ויקיפדיה:בוט/בוט מצעדים/מדיה פורסט',
  }, defaultDataFetcher);

  const data = await model.getMediaForestData();
  if (!data.entries?.length) {
    console.log('No data found');
    return;
  }
  await model.updateChartTable([data]);
  console.log('Media forest bot finished');
}

export const main = shabathProtectorDecorator(mdeiaForestBot);
