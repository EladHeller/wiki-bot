import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import KineretModel from '../kineret/KineretModel';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import WikiDataApiMock from '../../testConfig/mocks/wikiDataApi.mock';
import { WikiDataClaim } from '../types';
import {
  getChangeData, datesDifferenceInDays, formatDate, formatWikiDataDate, getValidTimeReference,
} from '../kineret/utils';

describe('kineretModel', () => {
  const mockWikiApi = WikiApiMock();
  const mockWikiDataApi = WikiDataApiMock();
  const mockDataFetcher = jest.fn<(url: string) => Promise<any>>();
  const mockGetCurrentDate = jest.fn<() => Date>();
  const mockConfig = {
    templatePage: 'תבנית:מפלס הכנרת',
    apiUrl: 'https://data.gov.il/api/3/action/datastore_search?resource_id=test&limit=1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentDate.mockReturnValue(new Date('2025-01-15'));
  });

  describe('fetchLevelData', () => {
    it('should fetch and return level data with date in DD/MM/YY format', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      const result = await model.fetchLevelData();

      expect(result.level).toBe('-210.5');
      expect(result.date).toBeInstanceOf(Date);
      expect(mockDataFetcher).toHaveBeenCalledWith(mockConfig.apiUrl);
    });

    it('should fetch and return level data with date in D/M/YYYY format', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '15/1/2026',
            Kinneret_Level: -213.3,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      const result = await model.fetchLevelData();

      expect(result.level).toBe('-213.3');
      expect(result.date.getFullYear()).toBe(2026);
      expect(result.date.getMonth()).toBe(0); // Jan is 0
      expect(result.date.getDate()).toBe(15);
      expect(mockDataFetcher).toHaveBeenCalledWith(mockConfig.apiUrl);
    });

    it('should handle ISO date format if slash format fails', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '2025-01-14',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      const result = await model.fetchLevelData();

      expect(result.level).toBe('-210.5');
      expect(result.date.toISOString()).toContain('2025-01-14');
    });

    it('should throw error when date is invalid', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: 'invalid-date',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.fetchLevelData()).rejects.toThrow('Invalid date from API');
    });
  });

  describe('updateWikiTemplate', () => {
    const mockTemplateContent = `{{#switch: {{{מאפיין}}}
|תאריך גובה=10 בינואר 2025
|גובה=-211
|שינוי=ירידה של 5 ס"מ [[File:Decrease2.svg|11px]] מלפני {{הפרש תאריכים|5|1|2025|10|1|2025}}
}}`;

    it('should update template with new level data', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledTimes(1);
      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        'תבנית:מפלס הכנרת/נתונים',
        'עדכון מפלס',
        expect.stringContaining('-210.5'),
        123,
      );
      expect(mockWikiApi.purge).toHaveBeenCalledWith(['תבנית:מפלס הכנרת']);
    });

    it('should show increase when level rises', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -209,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        'תבנית:מפלס הכנרת/נתונים',
        'עדכון מפלס',
        expect.stringContaining('עלייה'),
        123,
      );
    });

    it('should show no change when level is the same', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -211,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).toHaveBeenCalledWith(
        'תבנית:מפלס הכנרת/נתונים',
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
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });

    it('should not update when new date is older than current template date', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '05/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });

    it('should not update when date is the same as template date', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '10/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiTemplate();

      expect(mockWikiApi.edit).not.toHaveBeenCalled();
    });

    it('should throw error when template not found', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: 'No template here',
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiTemplate()).rejects.toThrow('Template not found');
    });

    it('should throw error when content is missing', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: '',
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiTemplate()).rejects.toThrow('Missing content for תבנית:מפלס הכנרת/נתונים');
    });

    it('should throw error when revid is missing', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: Number.NaN,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiTemplate()).rejects.toThrow('Missing revid for תבנית:מפלס הכנרת/נתונים');
    });

    it('should use cached data if fetchLevelData was called before', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiApi.articleContent.mockResolvedValueOnce({
        content: mockTemplateContent,
        revid: 123,
      });

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.fetchLevelData();
      await model.updateWikiTemplate();

      expect(mockDataFetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateWikiData', () => {
    const createValidClaim = (amount: number, referenceUrl: string): WikiDataClaim => ({
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
      id: 'Q126982$test',
      rank: 'normal',
      references: [{
        snaks: {
          P854: [{
            snaktype: 'value',
            property: 'P854',
            datatype: 'url',
            datavalue: {
              value: referenceUrl,
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

    const KINERET_REF_URL = 'https://data.gov.il/he/datasets/water_authority/https-www-data-gov-il-dataset-682';

    it('should update WikiData when level changes significantly', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim.mockResolvedValueOnce([createValidClaim(-211, KINERET_REF_URL)]);
      mockWikiDataApi.getRevId.mockResolvedValueOnce(456);
      mockWikiDataApi.setClaim.mockResolvedValueOnce({ success: 1 } as any);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.login).toHaveBeenCalledWith();
      expect(mockWikiDataApi.setClaim).toHaveBeenCalledWith(
        expect.objectContaining({
          mainsnak: expect.objectContaining({
            datavalue: expect.objectContaining({
              value: expect.objectContaining({
                amount: '-210.5',
              }),
            }),
          }),
        }),
        'Update Sea of Galilee elevation',
        456,
      );
    });

    it('should not update WikiData when level change is less than 0.02', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim.mockResolvedValueOnce([createValidClaim(-210.51, KINERET_REF_URL)]);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.updateWikiData();

      expect(mockWikiDataApi.setClaim).not.toHaveBeenCalled();
    });

    it('should throw error when claim is not valid - wrong unit', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidClaim = createValidClaim(-211, KINERET_REF_URL);
      invalidClaim.mainsnak.datavalue.value.unit = 'http://www.wikidata.org/entity/Q828224';
      mockWikiDataApi.getClaim.mockResolvedValueOnce([invalidClaim]);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should throw error when there are multiple claims', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim.mockResolvedValueOnce([
        createValidClaim(-211, KINERET_REF_URL),
        createValidClaim(-212, KINERET_REF_URL),
      ]);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should throw error when WikiData update fails', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim.mockResolvedValueOnce([createValidClaim(-211, KINERET_REF_URL)]);
      mockWikiDataApi.getRevId.mockResolvedValueOnce(456);
      mockWikiDataApi.setClaim.mockResolvedValueOnce({ success: 0 } as any);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('Failed to update');
    });

    it('should throw error when claim has wrong reference URL', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidClaim = createValidClaim(-211, 'https://wrong-url.com');
      mockWikiDataApi.getClaim.mockResolvedValueOnce([invalidClaim]);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should throw error when claim has no time reference', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);

      const invalidClaim = createValidClaim(-211, KINERET_REF_URL);
      delete (invalidClaim.references as NonNullable<typeof invalidClaim.references>)[0].snaks.P813;
      mockWikiDataApi.getClaim.mockResolvedValueOnce([invalidClaim]);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);

      await expect(model.updateWikiData()).rejects.toThrow('elevation claim is not valid');
    });

    it('should use cached data if fetchLevelData was called before', async () => {
      const mockResponse = {
        result: {
          records: [{
            Survey_Date: '14/01/25',
            Kinneret_Level: -210.5,
            _id: 1,
          }],
        },
      };
      mockDataFetcher.mockResolvedValueOnce(mockResponse);
      mockWikiDataApi.getClaim.mockResolvedValueOnce([createValidClaim(-211, KINERET_REF_URL)]);
      mockWikiDataApi.getRevId.mockResolvedValueOnce(456);
      mockWikiDataApi.setClaim.mockResolvedValueOnce({ success: 1 } as any);

      const model = KineretModel(mockWikiApi, mockWikiDataApi, mockConfig, mockDataFetcher, mockGetCurrentDate);
      await model.fetchLevelData();
      await model.updateWikiData();

      expect(mockDataFetcher).toHaveBeenCalledTimes(1);
    });
  });
});

describe('utils', () => {
  describe('getChangeData', () => {
    it('should return no change when change is 0', () => {
      const result = getChangeData(0);

      expect(result.text).toBe('ללא שינוי');
      expect(result.icon).toBe('[[File:Steady2.svg|11px]]');
    });

    it('should return increase when change is positive', () => {
      const result = getChangeData(0.15);

      expect(result.text).toBe('עלייה של 15 ס"מ');
      expect(result.icon).toBe('[[File:Increase2.svg|11px]]');
    });

    it('should return decrease when change is negative', () => {
      const result = getChangeData(-0.25);

      expect(result.text).toBe('ירידה של 25 ס"מ');
      expect(result.icon).toBe('[[File:Decrease2.svg|11px]]');
    });
  });

  describe('datesDifferenceInDays', () => {
    it('should return correct date difference template', () => {
      const date1 = new Date('2025-01-10');
      const date2 = new Date('2025-01-14');
      const result = datesDifferenceInDays(date1, date2);

      expect(result).toBe('{{הפרש תאריכים|10|1|2025|14|1|2025}}');
    });

    it('should throw error when date1 is after date2', () => {
      const date1 = new Date('2025-01-14');
      const date2 = new Date('2025-01-10');

      expect(() => datesDifferenceInDays(date1, date2)).toThrow('date1 must be before date2');
    });
  });

  describe('formatDate', () => {
    it('should format date in Hebrew', () => {
      const date = new Date('2025-01-14');
      const result = formatDate(date);

      expect(result).toContain('14');
      expect(result).toContain('2025');
    });
  });

  describe('formatWikiDataDate', () => {
    it('should format date in WikiData format', () => {
      const date = new Date('2025-01-14');
      const result = formatWikiDataDate(date);

      expect(result).toMatch(/^\+\d{4}-\d{2}-\d{2}T00:00:00Z$/);
    });
  });

  describe('getValidTimeReference', () => {
    const createClaim = (unit: string, refUrl: string, hasTimeRef: boolean): WikiDataClaim => ({
      mainsnak: {
        snaktype: 'value',
        property: 'P2044',
        datavalue: {
          value: { amount: '-210', unit },
          type: 'quantity',
        },
      },
      'qualifiers-order': [],
      type: 'statement',
      id: 'test',
      rank: 'normal',
      references: [{
        snaks: {
          P854: [{
            snaktype: 'value',
            property: 'P854',
            datatype: 'url',
            datavalue: { value: refUrl, type: 'string' },
          }],
          ...(hasTimeRef ? {
            P813: [{
              snaktype: 'value',
              property: 'P813',
              datatype: 'time',
              datavalue: { value: { time: '+2025-01-10T00:00:00Z' }, type: 'time' },
            }],
          } : {}),
        },
        'snaks-order': ['P854', 'P813'],
      }],
    });

    it('should return time reference value for valid claim', () => {
      const claim = createClaim(
        'http://www.wikidata.org/entity/Q11573',
        'https://test.com',
        true,
      );

      const result = getValidTimeReference(claim, 'https://test.com');

      expect(result).toStrictEqual({ time: '+2025-01-10T00:00:00Z' });
    });

    it('should return null for wrong unit', () => {
      const claim = createClaim(
        'http://www.wikidata.org/entity/Q828224',
        'https://test.com',
        true,
      );

      expect(getValidTimeReference(claim, 'https://test.com')).toBeNull();
    });

    it('should return null for wrong reference URL', () => {
      const claim = createClaim(
        'http://www.wikidata.org/entity/Q11573',
        'https://wrong.com',
        true,
      );

      expect(getValidTimeReference(claim, 'https://test.com')).toBeNull();
    });

    it('should return null for missing time reference', () => {
      const claim = createClaim(
        'http://www.wikidata.org/entity/Q11573',
        'https://test.com',
        false,
      );

      expect(getValidTimeReference(claim, 'https://test.com')).toBeNull();
    });

    it('should return null for missing references', () => {
      const claim = createClaim(
        'http://www.wikidata.org/entity/Q11573',
        'https://test.com',
        true,
      );
      claim.references = undefined;

      expect(getValidTimeReference(claim, 'https://test.com')).toBeNull();
    });
  });
});
