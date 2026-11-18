import botLoggerDecorator from '../decorators/botLoggerDecorator';
import { runCopyrightViolationBot } from './copyrightViolationCore';
import copyrightViolationPages from './copyrightViolationPages';

export default async function copyrightViolationBot() {
  await runCopyrightViolationBot(copyrightViolationPages.new, 'new');
}

export const main = botLoggerDecorator(copyrightViolationBot, { botName: 'בוט הפרת זכויות יוצרים' });
