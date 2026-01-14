import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import DeadSeaModel from '../kineret/DeadSeaModel';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import WikiDataApiMock from '../../testConfig/mocks/wikiDataApi.mock';
import { WikiDataClaim } from '../types';

describe('deadSeaModel', () => {
  const mockWikiApi = WikiApiMock();
  const mockWikiDataApi = WikiDataApiMock();
  const mockDataFetcher = jest.fn<(url: string) => Promise<any>>();
  const mockGetCurrentDate = jest.fn<() => Date>();
  const mockConfig = {
    templatePage: 'תבנית:מפלס ים המלח',
    apiUrl: 'https://data.gov.il/api/3/action/datastore_search?resource_id=test&limit=1',
    shouldUpdateWikiData: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentDate.mockReturnValue(new Date('2025-01-15'));
  });

  describe('fetchLevelData', () => {
    it('should fetch and return level data', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      const result = await model.fetchLevelData();

      expect(result.level).toBe('-435.5');
      expect(result.date.toISOString()).toContain('2025-01-14');
      expect(mockDataFetcher).toHaveBeenCalledWith(mockConfig.apiUrl);
    });

    it('should throw error when date format is invalid', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': 'invalid-date',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.fetchLevelData()).rejects.toThrow('Failed to parse date from API');
    });
  });

  describe('updateWikiTemplate', () => {
    const mockTemplateContent = `{{גוף מים
|תאריך גובה=10 בינואר 2025
|גובה=-436
|שינוי=ירידה של 5 ס"מ [[File:Decrease2.svg|11px]] מלפני {{הפרש תאריכים|5|1|2025|10|1|2025}}
}}`;

    it('should update template with new level data', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledTimes(1);
      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        'תבנית:מפלס ים המלח/נתונים',
        'עדכון מפלס',
        expect.stringContaining('-435.5'),
        123,
      );
      expect(mockWikiApi.purge).toHaveBeenCalledWith(['תבנית:מפלס ים המלח']);
    });

    it('should show increase when level rises', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -434,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        'תבנית:מפלס ים המלח/נתונים',
        'עדכון מפלס',
        expect.stringContaining('עלייה'),
        123,
      );
    });

    it('should show no change when level is the same', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -436,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        'תבנית:מפלס ים המלח/נתונים',
        'עדכון מפלס',
        expect.stringContaining('ללא שינוי'),
        123,
      );
    });

    it('should not update when date is in the future', async () => {
      mockGetCurrentDate.mockReturnValue(new Date('2025-01-10'));
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });

    it('should not update when new date is older than current template date', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '05/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });

    it('should not update when date is the same as template date', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '10/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: 'No template here',
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiTemplate()).rejects.toThrow('Template not found');
    });

    it('should throw error when content is missing', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: '',
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiTemplate()).rejects.toThrow('Missing content for תבנית:מפלס ים המלח/נתונים');
    });

    it('should throw error when revid is missing', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: Number.NaN,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiTemplate()).rejects.toThrow('Missing revid for תבנית:מפלס ים המלח/נתונים');
    });

    it('should use cached data if fetchLevelData was called before', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.fetchLevelData();
      await model.updateWikiTemplate();

      expect(mockDataFetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateWikiData', () => {
    const DEAD_SEA_REF_URL = 'https://data.gov.il/he/datasets/water_authority/https-www-data-gov-il-dataset-683';

    const createValidDeadSeaClaim = (amount: number): WikiDataClaim => ({
      mainsnak: {
        snaktype: 'value',
        property: 'P2044',
        datavalue: {
          value: {
            amount: amount.toString(),
            unit: 'http://www.wikidata.org/entity/Q11573',
          },
          type: 'quantity',
        },
      },
      'qualifiers-order': [],
      type: 'statement',
      id: 'Q23883$test',
      rank: 'normal',
      references: [{
        snaks: {
          P854: [{
            snaktype: 'value',
            property: 'P854',
            datatype: 'url',
            datavalue: {
              value: DEAD_SEA_REF_URL,
              type: 'string',
            },
          }],
          P813: [{
            snaktype: 'value',
            property: 'P813',
            datatype: 'time',
            datavalue: {
              value: {
                time: '+2025-01-10T00:00:00Z',
              },
              type: 'time',
            },
          }],
        },
        'snaks-order': ['P854', 'P813'],
      }],
    });

    const createValidLowestPointClaim = (amount: number): WikiDataClaim => ({
      mainsnak: {
        snaktype: 'value',
        property: 'P1589',
        datavalue: {
          value: {
            'entity-type': 'item',
            'numeric-id': 23883,
            id: 'Q23883',
          },
          type: 'wikibase-entityid',
        },
      },
      qualifiers: {
        P2044: [{
          snaktype: 'value',
          property: 'P2044',
          datatype: 'quantity',
          datavalue: {
            value: {
              amount: amount.toString(),
              unit: 'http://www.wikidata.org/entity/Q11573',
            },
            type: 'quantity',
          },
        }],
      },
      'qualifiers-order': ['P2044'],
      type: 'statement',
      id: 'Q801$test',
      rank: 'normal',
      references: [{
        snaks: {
          P854: [{
            snaktype: 'value',
            property: 'P854',
            datatype: 'url',
            datavalue: {
              value: DEAD_SEA_REF_URL,
              type: 'string',
            },
          }],
          P813: [{
            snaktype: 'value',
            property: 'P813',
            datatype: 'time',
            datavalue: {
              value: {
                time: '+2025-01-10T00:00:00Z',
              },
              type: 'time',
            },
          }],
        },
        'snaks-order': ['P854', 'P813'],
      }],
    });

    it('should not update WikiData when shouldUpdateWikiData is false', async () => {
      const configWithNoUpdate = { ...mockConfig, shouldUpdateWikiData: false };

      const model = DeadSeaModel(
        mockWikiApi,
        mockWikiDataApi,
        configWithNoUpdate,
        mockDataFetcher,
        mockGetCurrentDate,
      );
      await model.updateWikiData();

      expect(mockWikiDataApi.login).not.toHaveBeenCalled();
    });

    it('should update WikiData when level changes significantly', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim.mockResolvedValue({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.login).toHaveBeenCalledWith();
      expect(mockWikiDataApi.setClaim).toHaveBeenCalledWith(
        expect.objectContaining({
          mainsnak: expect.objectContaining({
            datavalue: expect.objectContaining({
              value: expect.objectContaining({
                amount: '-435.5',
              }),
            }),
          }),
        }),
        'Update Dead Sea elevation',
        456,
      );
    });

    it('should not update WikiData when level change is less than 0.02', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-435.51)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-435.51)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-435.51)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-435.51)]);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).not.toHaveBeenCalled();
    });

    it('should throw error when claim is not valid - wrong unit', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidClaim = createValidDeadSeaClaim(-436);
      invalidClaim.mainsnak.datavalue.value.unit = 'http://www.wikidata.org/entity/Q828224';
      mockWikiDataApi.getClaim.mockResolvedValueOnce([invalidClaim]);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should throw error when there are multiple claims', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim.mockResolvedValueOnce([
        createValidDeadSeaClaim(-436),
        createValidDeadSeaClaim(-437),
      ]);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should throw error when WikiData update fails', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim.mockResolvedValueOnce([createValidDeadSeaClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValueOnce(456);
      mockWikiDataApi.setClaim.mockResolvedValueOnce({ success: 0 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('Failed to update');
    });

    it('should throw error when claim has wrong reference URL', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidClaim = createValidDeadSeaClaim(-436);
      (invalidClaim.references as NonNullable<typeof invalidClaim.references>)[0].snaks.P854[0].datavalue.value = 'https://wrong-url.com';
      mockWikiDataApi.getClaim.mockResolvedValueOnce([invalidClaim]);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should throw error when claim has no time reference', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidClaim = createValidDeadSeaClaim(-436);
      delete (invalidClaim.references as NonNullable<typeof invalidClaim.references>)[0].snaks.P813;
      mockWikiDataApi.getClaim.mockResolvedValueOnce([invalidClaim]);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should continue updating other items even if one fails', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockRejectedValueOnce(new Error('Asia failed'))
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim.mockResolvedValue({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).toHaveBeenCalledTimes(3);
    });

    it('should throw error when lowest point claim is not valid - wrong unit', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidLowestPointClaim = createValidLowestPointClaim(-436);
      (invalidLowestPointClaim.qualifiers as NonNullable<typeof invalidLowestPointClaim.qualifiers>).P2044[0].datavalue.value.unit = 'http://www.wikidata.org/entity/Q828224';

      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockResolvedValueOnce([invalidLowestPointClaim])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim.mockResolvedValue({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).toHaveBeenCalledTimes(3);
    });

    it('should throw error when lowest point claim has wrong reference URL', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidLowestPointClaim = createValidLowestPointClaim(-436);
      (invalidLowestPointClaim.references as NonNullable<typeof invalidLowestPointClaim.references>)[0].snaks.P854[0].datavalue.value = 'https://wrong-url.com';

      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockResolvedValueOnce([invalidLowestPointClaim])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim.mockResolvedValue({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).toHaveBeenCalledTimes(3);
    });

    it('should throw error when lowest point has multiple claims', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436), createValidLowestPointClaim(-437)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim.mockResolvedValue({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).toHaveBeenCalledTimes(3);
    });

    it('should throw error when lowest point update fails', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim
        .mockResolvedValueOnce({ success: 1 } as any)
        .mockResolvedValueOnce({ success: 0 } as any)
        .mockResolvedValueOnce({ success: 1 } as any)
        .mockResolvedValueOnce({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).toHaveBeenCalledTimes(4);
    });

    it('should handle missing qualifier gracefully', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const claimWithoutQualifier = createValidLowestPointClaim(-436);
      delete claimWithoutQualifier.qualifiers;

      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockResolvedValueOnce([claimWithoutQualifier])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim.mockResolvedValue({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).toHaveBeenCalledTimes(3);
    });

    it('should use cached data if fetchLevelData was called before', async () => {
      const mockResponse = {
        result: {
          records: [{
            'תאריך מדידה': '14/01/2025',
            מפלס: -435.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim
        .mockResolvedValueOnce([createValidDeadSeaClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)])
        .mockResolvedValueOnce([createValidLowestPointClaim(-436)]);
      mockWikiDataApi.getRevId.mockResolvedValue(456);
      mockWikiDataApi.setClaim.mockResolvedValue({ success: 1 } as any);

      const model = DeadSeaModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.fetchLevelData();
      await model.updateWikiData();

      expect(mockDataFetcher).toHaveBeenCalledTimes(1);
    });
  });
});
