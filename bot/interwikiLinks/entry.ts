import interwikiLinks from '.';
import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiApi from '../wiki/WikiApi';

export default async function foreignWikipediaMissingLinksParsedContent() {
  const api = WikiApi();
  await api.login();
  await interwikiLinks(api);
}

export const main = botLoggerDecorator(foreignWikipediaMissingLinksParsedContent, { botName: 'בוט קישורי שפה - הפניות' });
