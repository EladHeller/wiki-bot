import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import { logger } from '../../utilities/logger';
import WikiApi from '../../wiki/WikiApi';
import ClosedDiscussionsArchiveBotModel from './ClosedDiscussionsArchiveBotModel';

export default async function closedDiscussionsArchiveBot() {
  console.log('Starting closed discussions archive bot');
  const model = ClosedDiscussionsArchiveBotModel(WikiApi());
  const pages = await model.getPagesToArchive();
  for (const pageConfig of pages) {
    console.log(`Processing page: ${pageConfig.page} (type: ${pageConfig.archiveType})`);
    const archivableParagraphs = await model.getArchivableParagraphs(
      pageConfig.page,
      pageConfig.statuses,
      pageConfig.daysAfterLastActivity,
    );
    console.log(`Found ${archivableParagraphs.length} archivable paragraphs`);
    try {
      await model.archive(
        pageConfig.page,
        archivableParagraphs,
        pageConfig.archiveType,
        pageConfig.archiveNavigatePage,
        pageConfig.targetedArchiveRegularArchiveMode,
        pageConfig.addNewState,
        pageConfig.updateInDiscussionState,
      );
      console.log(`Archived ${archivableParagraphs.length} paragraphs`);
    } catch (error) {
      logger.logError(`Failed to archive page ${pageConfig.page}: ${error?.toString()}`);
    }
  }
}

export const main = botLoggerDecorator(closedDiscussionsArchiveBot, { botName: 'בוט ארכוב דיונים' });
