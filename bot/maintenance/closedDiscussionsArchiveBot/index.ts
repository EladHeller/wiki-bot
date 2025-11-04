import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi from '../../wiki/WikiApi';
import ClosedDiscussionsArchiveBotModel from './ClosedDiscussionsArchiveBotModel';

const pages: string[] = ['ויקיפדיה:העברת דפי טיוטה'];

export default async function closedDiscussionsArchiveBot() {
  console.log('Starting closed discussions archive bot');
  const model = ClosedDiscussionsArchiveBotModel(WikiApi());

  for (const page of pages) {
    console.log(`Processing page: ${page}`);
    const archivableParagraphs = await model.getArchivableParagraphs(page);
    console.log(`Found ${archivableParagraphs.length} archivable paragraphs`);
    await model.archive(page, archivableParagraphs);
    console.log(`Archived ${archivableParagraphs.length} paragraphs`);
  }
}

export const main = shabathProtectorDecorator(closedDiscussionsArchiveBot);
