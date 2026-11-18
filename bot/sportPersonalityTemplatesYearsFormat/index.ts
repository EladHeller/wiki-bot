import writeAdminBotLogs from '../admin/log';
import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiApi from '../wiki/WikiApi';
import sportPersonalityTemplatesYearsFormatModel from './model';

import reportPage from './reportPage';

export default async function sportPersonalityTemplatesYearsFormat() {
  const api = WikiApi();
  const { logs, processedCount } = await sportPersonalityTemplatesYearsFormatModel(api);
  await writeAdminBotLogs(api, logs, reportPage, false);

  const updatedCount = logs.filter((log) => !log.error).length;
  const errorCount = logs.filter((log) => log.error).length;

  console.log(`Processed ${processedCount} articles`);
  console.log(`Updated: ${updatedCount} articles`);
  if (errorCount > 0) {
    console.log(`Errors: ${errorCount} articles`);
  }
}
export const main = botLoggerDecorator(sportPersonalityTemplatesYearsFormat, { botName: 'בוט פורמט שנים בתבניות אישיות ספורט' });
