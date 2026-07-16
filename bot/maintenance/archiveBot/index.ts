import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import WikiApi from '../../wiki/WikiApi';
import ArchiveBotModel from './ArchiveBotModel';

const pages = [
  `משתמש:${process.env.BOT_NAME}/הגנת דפים שמופיעים בעמוד הראשי`,
  `משתמש:${process.env.BOT_NAME}/מחיקת הפניות חוצות מרחבי שם`,
  'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים',
  'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים/לוג',
  'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים/עריכות',
  'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים/עריכות/לוג',
];

const archiveBySignatureDatePages = [
  `משתמש:${process.env.BOT_NAME}/אימיילים`,
  `משתמש:${process.env.BOT_NAME}/לוג ריצות`,
];

export default async function archiveBot() {
  console.log('Starting archive bot');
  const model = ArchiveBotModel(WikiApi());
  for (const page of pages) {
    await model.updateArchiveTemplate(page);
    await model.archiveContent(page);
  }

  for (const page of archiveBySignatureDatePages) {
    await model.updateArchiveTemplate(page);
    await model.archiveContent(page, 'signatureDate');
  }
}

export const main = botLoggerDecorator(archiveBot, { botName: 'בוט ארכוב לוגים' });
