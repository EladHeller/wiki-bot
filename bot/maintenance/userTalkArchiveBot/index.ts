import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi from '../../wiki/WikiApi';
import UserTalkArchiveBotModel from './UserTalkArchiveBotModel';

export default async function userTalkArchiveBot() {
  const model = UserTalkArchiveBotModel(WikiApi());
  await model.run();
}

export const main = shabathProtectorDecorator(userTalkArchiveBot);
