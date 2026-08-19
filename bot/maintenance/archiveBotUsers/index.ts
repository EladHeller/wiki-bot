import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi from '../../wiki/WikiApi';
import ArchiveBotUsersModel from './ArchiveBotUsersModel';

export default async function archiveBotUsers() {
  const api = WikiApi();
  await api.login();
  await ArchiveBotUsersModel(api).update();
}

export const main = botLoggerDecorator(archiveBotUsers, { botName: 'עדכון משתמשי בוט הארכוב' });
