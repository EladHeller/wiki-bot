import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi from '../../wiki/WikiApi';
import UserTalkArchiveBotModel from './UserTalkArchiveBotModel';

export default async function userTalkArchiveBot() {
  const api = WikiApi();
  await api.login();
  const model = UserTalkArchiveBotModel(api);
  await model.run();
}

export const main = shabathProtectorDecorator(userTalkArchiveBot);
