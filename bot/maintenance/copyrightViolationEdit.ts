import botLoggerDecorator from '../decorators/botLoggerDecorator';
import { runCopyrightViolationBot } from './copyrightViolationCore';

const BASE_PAGE = 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים/עריכות';

export default async function editsCopyrightViolationBot() {
  await runCopyrightViolationBot(BASE_PAGE, 'edit');
}

export const main = botLoggerDecorator(editsCopyrightViolationBot, { botName: 'בוט הפרת זכויות יוצרים עריכות' });
