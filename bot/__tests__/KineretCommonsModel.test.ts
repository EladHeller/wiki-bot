import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import KineretCommonsModel, {
  buildKineretChartDefinition,
  buildKineretTabularData,
  KINERET_CHART_PAGE,
  KINERET_DATA_PAGE,
  KINERET_HISTORY_API_URL,
} from '../kineret/KineretCommonsModel';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { KineretLevelRecord } from '../kineret/utils';

const records: KineretLevelRecord[] = [
  { _id: 1, Survey_Date: '2/1/2025', Kinneret_Level: -211.5 },
  { _id: 2, Survey_Date: '01/12/24', Kinneret_Level: -211.3 },
];

describe('kineret Commons model', () => {
  const wikiApi = WikiApiMock();
  const dataFetcher = jest.fn<(url: string) => Promise<any>>();

  beforeEach(() => {
    jest.clearAllMocks();
    dataFetcher.mockResolvedValue({ result: { records } });
  });

  it('builds chronologically sorted tabular data with ISO dates and numeric levels', () => {
    const result = JSON.parse(buildKineretTabularData(records));

    expect(result.license).toBe('CC0-1.0');
    expect(result.schema.fields[0]).toMatchObject({ name: 'date', type: 'string' });
    expect(result.schema.fields[1]).toMatchObject({ name: 'level', type: 'number' });
    expect(result.data).toStrictEqual([
      ['2024-12-01', -211.3],
      ['2025-01-02', -211.5],
    ]);
  });

  it('rejects empty data', () => {
    expect(() => buildKineretTabularData([])).toThrow('returned no records');
  });

  it('rejects invalid dates', () => {
    expect(() => buildKineretTabularData([
      { _id: 1, Survey_Date: 'invalid', Kinneret_Level: -211.5 },
    ])).toThrow('Invalid Kinneret survey date');
  });

  it('rejects invalid levels', () => {
    expect(() => buildKineretTabularData([
      { _id: 1, Survey_Date: '2/1/2025', Kinneret_Level: Number.NaN },
    ])).toThrow('Invalid Kinneret level');
  });

  it('builds a localized line chart definition', () => {
    const result = JSON.parse(buildKineretChartDefinition());

    expect(result).toMatchObject({
      license: 'CC0-1.0',
      version: 1,
      source: 'Sandbox/sapper-bot/Kineret-Level.tab',
      type: 'line',
      title: { he: 'מפלס הכנרת', en: 'Sea of Galilee water level' },
    });
  });

  it('updates both Commons data pages', async () => {
    wikiApi.articleContent
      .mockResolvedValueOnce({ content: 'old data', revid: 10 })
      .mockResolvedValueOnce({ content: 'old chart', revid: 20 });

    const result = await KineretCommonsModel(wikiApi, dataFetcher).updateGraph();

    expect(dataFetcher).toHaveBeenCalledWith(KINERET_HISTORY_API_URL);
    expect(wikiApi.edit).toHaveBeenNthCalledWith(
      1,
      KINERET_DATA_PAGE,
      'עדכון נתוני מפלס הכנרת',
      buildKineretTabularData(records),
      10,
    );
    expect(wikiApi.edit).toHaveBeenNthCalledWith(
      2,
      KINERET_CHART_PAGE,
      'עדכון נתוני מפלס הכנרת',
      buildKineretChartDefinition(),
      20,
    );
    expect(result).toStrictEqual({ dataUpdated: true, chartUpdated: true });
  });

  it('does not edit pages whose content is current', async () => {
    wikiApi.articleContent
      .mockResolvedValueOnce({ content: buildKineretTabularData(records), revid: 10 })
      .mockResolvedValueOnce({ content: buildKineretChartDefinition(), revid: 20 });

    const result = await KineretCommonsModel(wikiApi, dataFetcher).updateGraph();

    expect(wikiApi.edit).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ dataUpdated: false, chartUpdated: false });
  });
});
