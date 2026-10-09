import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi from '../../wiki/WikiApi';
import ImportanceDiscussionsModel from './model';

export default async function importanceDiscussions() {
  const api = WikiApi();
  await api.login();
  await ImportanceDiscussionsModel(api, {
    stateTitle: `משתמש:${process.env.BOT_NAME}/בוט חשיבות/מצב`,
    dryRun: process.env.IMPORTANCE_DISCUSSIONS_DRY_RUN !== 'false',
  }).run();
}

export const main = botLoggerDecorator(importanceDiscussions, { botName: 'בוט דיוני חשיבות' });
