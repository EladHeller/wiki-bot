import writeAdminBotLogs from '../admin/log';
import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiApi from '../wiki/WikiApi';
import informationTemplateCleanupModel from './model';

const LOG_PAGE_TITLE = 'ויקיפדיה:בוט/ניקוי ערכי אין ולא ידוע בתבנית מידע';

export default async function informationTemplateCleanup() {
  const api = WikiApi();
  const { logs, processedCount } = await informationTemplateCleanupModel(api);
  await writeAdminBotLogs(api, logs, LOG_PAGE_TITLE, false);

  const updatedCount = logs.filter((log) => !log.error).length;
  const errorCount = logs.filter((log) => log.error).length;

  console.log(`Processed ${processedCount} files`);
  console.log(`Updated: ${updatedCount} files`);
  if (errorCount > 0) {
    console.log(`Errors: ${errorCount} files`);
  }
}

export const main = botLoggerDecorator(informationTemplateCleanup, { botName: 'בוט ניקוי ערכי מידע חסרים בתבנית מידע' });
