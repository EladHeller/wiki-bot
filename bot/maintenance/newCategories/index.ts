import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi from '../../wiki/WikiApi';
import NewCategoriesModel from './model';

export default async function newCategories() {
  const api = WikiApi();
  await api.login();

  const model = NewCategoriesModel(api);

  await model.updateNewCategories();
  await model.createLastMonthCategoriesPageIfNeeded();
}

export const main = botLoggerDecorator(newCategories, {
  botName: 'בוט קטגוריות חדשות',
});
