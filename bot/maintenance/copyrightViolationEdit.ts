import botLoggerDecorator from '../decorators/botLoggerDecorator';
import { runCopyrightViolationBot } from './copyrightViolationCore';
import copyrightViolationPages from './copyrightViolationPages';

export default async function editsCopyrightViolationBot() {
  await runCopyrightViolationBot(copyrightViolationPages.edit, 'edit');
}

export const main = botLoggerDecorator(editsCopyrightViolationBot, { botName: 'בוט הפרת זכויות יוצרים עריכות' });
