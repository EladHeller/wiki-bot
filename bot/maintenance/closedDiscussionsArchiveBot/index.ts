import shabathProtectorDecorator from '../../decorators/shabathProtector';
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
    );
    console.log(`Found ${archivableParagraphs.length} archivable paragraphs`);
    await model.archive(
      pageConfig.page,
      archivableParagraphs,
      pageConfig.archiveType,
      pageConfig.archiveNavigatePage,
    );
    console.log(`Archived ${archivableParagraphs.length} paragraphs`);
  }
}

export const main = shabathProtectorDecorator(closedDiscussionsArchiveBot);
