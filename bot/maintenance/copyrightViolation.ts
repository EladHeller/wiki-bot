import botLoggerDecorator from '../decorators/botLoggerDecorator';
import { runCopyrightViolationBot } from './copyrightViolationCore';

const BASE_PAGE = 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים';

export default async function copyrightViolationBot() {
  await runCopyrightViolationBot(BASE_PAGE, 'new');
}

export const main = botLoggerDecorator(copyrightViolationBot, { botName: 'בוט הפרת זכויות יוצרים' });
