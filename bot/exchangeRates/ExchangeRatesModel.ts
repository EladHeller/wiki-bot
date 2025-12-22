import { IWikiApi } from '../wiki/WikiApi';
import { findTemplate, templateFromKeyValueData } from '../wiki/newTemplateParser';
import { getLocalDate } from '../utilities';

interface ExchangeRatesResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface IExchangeRatesModel {
  fetchRates(): Promise<ExchangeRatesResponse>;
  updateRatesTemplate(): Promise<void>;
}

interface ExchangeRatesConfig {
  apiBaseUrl: string;
  templatePage: string;
}

async function getContent(wikiApi: IWikiApi, title: string) {
  const result = await wikiApi.articleContent(title);
  if (!result || !result.content) {
    throw new Error(`Missing content for ${title}`);
  }
  if (!result.revid) {
    throw new Error(`Missing revid for ${title}`);
  }

  return result;
}

export default function ExchangeRatesModel(
  wikiApi: IWikiApi,
  config: ExchangeRatesConfig,
  dataFetcher: (url: string) => Promise<ExchangeRatesResponse>,
): IExchangeRatesModel {
  async function fetchRates(): Promise<ExchangeRatesResponse> {
    const data = await dataFetcher(`${config.apiBaseUrl}/latest`);
    if (!data || !data.rates || !data.date) {
      throw new Error('Invalid data received from API');
    }
    if (data.base !== 'EUR') {
      throw new Error('Expected EUR as base currency');
    }
    return data;
  }

  async function updateRatesTemplate(): Promise<void> {
    const ratesData = await fetchRates();
    const { content, revid } = await getContent(wikiApi, config.templatePage);

    const templateName = '#switch: {{{1}}}';
    const oldTemplate = findTemplate(content, templateName, config.templatePage);

    if (!oldTemplate) {
      throw new Error('Template not found');
    }
    ratesData.rates.EUR = 1; // For simplicity, set EUR to 1
    const templateData: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(ratesData.rates).map(([currency, rate]) => [
          currency,
          rate.toString(),
        ]),
      ),
      date: getLocalDate(ratesData.date),
      '#default': '',
    };

    const newTemplate = templateFromKeyValueData(templateData, templateName, true);
    const newContent = content.replace(oldTemplate, newTemplate);

    if (newContent === content) {
      console.log('No changes detected');
      return;
    }

    await wikiApi.edit(config.templatePage, 'עדכון שערי חליפין', newContent, revid);
    await wikiApi.purge([config.templatePage.replace('/נתונים', ''), 'תבנית:שער חליפין בין מטבעות', 'תבנית:שערי חליפין למטבע']);
  }

  return {
    fetchRates,
    updateRatesTemplate,
  };
}
