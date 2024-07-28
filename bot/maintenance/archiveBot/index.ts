import shabathProtectorDecorator from '../../decorators/shabathProtector';
import BaseWikiApi, { defaultConfig } from '../../wiki/BaseWikiApi';
import NewWikiApi from '../../wiki/NewWikiApi';
import ArchiveBotModel from './ArchiveBotModel';

const pages = [
  'משתמש:Sapper-bot/הגנת דפים שמופיעים בעמוד הראשי',
  'משתמש:Sapper-bot/מחיקת הפניות חוצות מרחבי שם',
  // 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים',
  // 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים/לוג',
];

export default async function archiveBot() {
  console.log('Starting archive bot');
  const model = ArchiveBotModel(NewWikiApi(BaseWikiApi(defaultConfig)));
  for (const page of pages) {
    await model.updateArchiveTemplate(page);
    await model.archiveContent(page);
  }
}

export const main = shabathProtectorDecorator(archiveBot);
