import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi from '../../wiki/WikiApi';
import ArchiveBotModel from './ArchiveBotModel';

const pages = [
  'משתמש:Sapper-bot/הגנת דפים שמופיעים בעמוד הראשי',
  'משתמש:Sapper-bot/מחיקת הפניות חוצות מרחבי שם',
  'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים',
  'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים/לוג',
];

const archiveBySignatureDatePages = ['משתמש:Sapper-bot/אימיילים'];

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

export const main = shabathProtectorDecorator(archiveBot);
