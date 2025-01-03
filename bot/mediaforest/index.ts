import shabathProtectorDecorator from '../decorators/shabathProtector';
import NewWikiApi from '../wiki/NewWikiApi';
import MediaForestBotModel from './MediaForestModel';

export default async function mdeiaForestBot() {
  console.log('Starting media forest bot');
  const model = MediaForestBotModel(NewWikiApi());
  const data = await model.getMediaForestData();
  await model.updateChartTable(data);
  console.log('Media forest bot finished');
}

export const main = shabathProtectorDecorator(mdeiaForestBot);
