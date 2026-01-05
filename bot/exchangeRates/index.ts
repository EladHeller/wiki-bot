import botLoggerDecorator from '../decorators/botLoggerDecorator';
import WikiApi from '../wiki/WikiApi';
import ExchangeRatesModel from './ExchangeRatesModel';

const defaultDataFetcher = async (url: string) => {
  console.log(`Fetching exchange rates from ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch data from ${url}`);
  }
  return res.json();
};

export default async function exchangeRatesBot() {
  console.log('Starting exchange rates bot');
  const model = ExchangeRatesModel(WikiApi(), {
    apiBaseUrl: 'https://api.frankfurter.app',
    templatePage: 'תבנית:שערי חליפין (יורו)/נתונים',
  }, defaultDataFetcher);

  await model.updateRatesTemplate();
  console.log('Exchange rates bot finished');
}

export const main = botLoggerDecorator(exchangeRatesBot, { botName: 'בוט שערי חליפין' });
