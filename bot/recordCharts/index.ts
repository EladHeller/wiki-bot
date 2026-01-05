import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiApi from '../wiki/WikiApi';
import MediaForestBotModel from './MediaForestModel';

const defaultDataFetcher = async (url: string) => {
  console.log(`Fetching data from ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch data from ${url}`);
  }
  return res.json();
};

export default async function mediaForestBot() {
  console.log('Starting media forest bot');
  const model = MediaForestBotModel(WikiApi(), {
    baseUrl: 'https://mediaforest-group.com/',
    page: 'ויקיפדיה:בוט/בוט מצעדים/מדיה פורסט',
  }, defaultDataFetcher);

  const data = await model.getMediaForestData();
  if (!data.entries?.length) {
    console.log('No data found');
    return;
  }
  await model.updateChartTable([data]);

  console.log('Starting media forest bot TV');
  const modelTV = MediaForestBotModel(WikiApi(), {
    baseUrl: 'https://mediaforest-group.com/',
    page: 'ויקיפדיה:בוט/בוט מצעדים/מדיה פורסט TV',
  }, defaultDataFetcher);

  const dataTV = await modelTV.getMediaForestData('TV');
  if (!dataTV.entries?.length) {
    console.log('No data found');
    return;
  }
  await modelTV.updateChartTable([dataTV]);
  console.log('Media forest bot TV finished');
}

export const main = botLoggerDecorator(mediaForestBot, { botName: 'בוט מצעדי הפזמונים' });
