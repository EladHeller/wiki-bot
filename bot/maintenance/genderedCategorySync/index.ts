import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import genderedCategorySyncModel, { GenderedCategorySyncConfig } from './model';

export default async function genderedCategorySync(config: GenderedCategorySyncConfig = {}) {
  const report = await genderedCategorySyncModel(undefined, undefined, config);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

export const main = botLoggerDecorator(genderedCategorySync, { botName: 'בוט סנכרון קטגוריות גברים ונשים' });
