import {
  afterEach, describe, expect, it, jest,
} from '@jest/globals';
import axios from 'axios';
import { getMarketValueById } from '../API/mayaMarketValue';
import { logger } from '../utilities/logger';

const company = {
  companyId: 604,
  longName: 'בנק לאומי לישראל בע"מ',
  marketValue: 108_205_961,
  securitiesValidityDate: '2026-11-11',
};

describe('getMarketValueById', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the company-level value in thousands of shekels from the current Maya API', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: company });

    await expect(getMarketValueById('604')).resolves.toStrictEqual({
      id: 604,
      companyLongName: company.longName,
      marketValue: 108_205_961,
      correctionDate: '2026-11-11',
    });
    expect(get).toHaveBeenCalledWith('https://maya.tase.co.il/api/v1/companies/604/details', {
      headers: { Accept: 'application/json', 'Accept-Language': 'he' },
    });
  });

  it.each([null, 0])('keeps company details when the market value is %s', async (marketValue) => {
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        ...company, companyId: 651, longName: 'צים שירותי ספנות משולבים בע"מ', marketValue,
      },
    });

    await expect(getMarketValueById(651)).resolves.toStrictEqual({
      id: 651,
      companyLongName: 'צים שירותי ספנות משולבים בע"מ',
      marketValue,
      correctionDate: '2026-11-11',
    });
  });

  it.each([
    ['an HTML error page', '<html>Service unavailable</html>'],
    ['an empty body', null],
    ['a different company', { ...company, companyId: 651 }],
    ['a missing name', { ...company, longName: undefined }],
    ['a missing value', { ...company, marketValue: undefined }],
    ['a missing date', { ...company, securitiesValidityDate: undefined }],
    ['an invalid date', { ...company, securitiesValidityDate: 'invalid' }],
  ])('rejects %s', async (_label, data) => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data });

    await expect(getMarketValueById(604)).rejects.toThrow('Invalid Maya company details for 604');
  });

  it('logs and propagates a failed request', async () => {
    const error = new Error('Request failed with status code 503');
    const get = jest.spyOn(axios, 'get').mockRejectedValue(error);
    const log = jest.spyOn(logger, 'logError').mockImplementation(() => {});

    await expect(getMarketValueById(604)).rejects.toBe(error);
    expect(get).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Maya company details request failed for 604'));
  });
});
