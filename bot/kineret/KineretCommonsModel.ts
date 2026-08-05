import { IWikiApi } from '../wiki/WikiApi';
import { KineretApiResponse, KineretLevelRecord, parseKineretDate } from './utils';

export const KINERET_HISTORY_API_URL = 'https://data.gov.il/api/3/action/datastore_search?resource_id=2de7b543-e13d-4e7e-b4c8-56071bc4d3c8&limit=32000';
export const KINERET_DATA_PAGE = 'Data:Sandbox/sapper-bot/Kineret-Level.tab';
export const KINERET_CHART_PAGE = 'Data:Sandbox/sapper-bot/Kineret-Level.chart';

const KINERET_RESOURCE_URL = 'https://data.gov.il/dataset/https-www-data-gov-il-dataset-682/resource/2de7b543-e13d-4e7e-b4c8-56071bc4d3c8';
const KINERET_CHART_SOURCE = 'Sandbox/sapper-bot/Kineret-Level.tab';
const EDIT_SUMMARY = 'עדכון נתוני מפלס הכנרת';

export type KineretCommonsUpdateResult = {
  chartUpdated: boolean;
  dataUpdated: boolean;
};

function normalizeRecord(record: KineretLevelRecord): [string, number] {
  const date = parseKineretDate(record.Survey_Date);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Kinneret survey date: ${record.Survey_Date}`);
  }
  if (!Number.isFinite(record.Kinneret_Level)) {
    throw new Error(`Invalid Kinneret level for ${record.Survey_Date}`);
  }
  return [date.toISOString().slice(0, 10), record.Kinneret_Level];
}

export function buildKineretTabularData(records: KineretLevelRecord[]): string {
  if (records.length === 0) {
    throw new Error('Kinneret history API returned no records');
  }

  const data = records
    .map(normalizeRecord)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));

  return JSON.stringify({
    license: 'CC0-1.0',
    description: {
      he: 'מדידות מפלס הכנרת',
      en: 'Sea of Galilee water level measurements',
    },
    sources: `[${KINERET_RESOURCE_URL} Israel Government Data Portal]`,
    schema: {
      fields: [
        {
          name: 'date',
          type: 'string',
          title: {
            he: 'תאריך המדידה',
            en: 'Measurement date',
          },
        },
        {
          name: 'level',
          type: 'number',
          title: {
            he: 'מפלס (מטרים)',
            en: 'Water level (metres)',
          },
        },
      ],
    },
    data,
  }, null, 2);
}

export function buildKineretChartDefinition(): string {
  return JSON.stringify({
    license: 'CC0-1.0',
    version: 1,
    source: KINERET_CHART_SOURCE,
    type: 'line',
    title: {
      he: 'מפלס הכנרת',
      en: 'Sea of Galilee water level',
    },
    xAxis: {
      title: {
        he: 'תאריך',
        en: 'Date',
      },
    },
    yAxis: {
      title: {
        he: 'מפלס (מטרים)',
        en: 'Water level (metres)',
      },
    },
  }, null, 2);
}

export default function KineretCommonsModel(
  commonsApi: IWikiApi,
  dataFetcher: (url: string) => Promise<KineretApiResponse>,
) {
  async function updatePage(title: string, content: string): Promise<boolean> {
    const currentPage = await commonsApi.articleContent(title);
    if (currentPage.content === content) {
      return false;
    }
    await commonsApi.edit(title, EDIT_SUMMARY, content, currentPage.revid);
    return true;
  }

  async function updateGraph(): Promise<KineretCommonsUpdateResult> {
    const response = await dataFetcher(KINERET_HISTORY_API_URL);
    const dataUpdated = await updatePage(
      KINERET_DATA_PAGE,
      buildKineretTabularData(response.result.records),
    );
    const chartUpdated = await updatePage(KINERET_CHART_PAGE, buildKineretChartDefinition());
    return { chartUpdated, dataUpdated };
  }

  return { updateGraph };
}
