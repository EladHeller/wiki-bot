import writeAdminBotLogs from '../admin/log';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import WikiApi from '../wiki/WikiApi';
import sportPersonalityTemplatesYearsFormatModel from './model';

const LOG_PAGE_TITLE = 'ויקיפדיה:בוט/סדר בשדות תאריכים בתבניות אישיות ספורט';

export default async function sportPersonalityTemplatesYearsFormat() {
  const api = WikiApi();
  const { logs, processedCount } = await sportPersonalityTemplatesYearsFormatModel(api);
  await writeAdminBotLogs(api, logs, LOG_PAGE_TITLE, false);

  const updatedCount = logs.filter((log) => !log.error).length;
  const errorCount = logs.filter((log) => log.error).length;

  console.log(`✅ Processed ${processedCount} articles`);
  console.log(`✅ Updated: ${updatedCount} articles`);
  if (errorCount > 0) {
    console.log(`⚠️ Errors: ${errorCount} articles`);
  }
}
export const main = shabathProtectorDecorator(sportPersonalityTemplatesYearsFormat);
