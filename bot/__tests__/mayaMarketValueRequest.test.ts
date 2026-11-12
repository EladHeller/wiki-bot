import {
  afterEach, describe, expect, it, jest,
} from '@jest/globals';
import axios, { AxiosError, type AxiosResponse } from 'axios';

const sleep = jest.fn<(delay: number) => Promise<void>>().mockResolvedValue(undefined);
jest.unstable_mockModule('node:timers/promises', () => ({ setTimeout: sleep }));

const { default: requestMayaMarketValue } = await import('../API/mayaMarketValueRequest');

const url = 'https://mayaapi.tase.co.il/api/company/alldetails?companyId=651';
const options = { headers: { 'X-Maya-With': 'allow' } };
const response = { data: { CompanyDetails: { MarketValue: 123 } } };
const httpError = (status: number, retryAfter?: string) => new AxiosError(
  `Request failed with status code ${status}`,
  undefined,
  undefined,
  undefined,
  { status, headers: { 'retry-after': retryAfter } } as AxiosResponse,
);

describe('requestMayaMarketValue', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    sleep.mockClear();
  });

  it('applies a timeout and returns the first successful response', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue(response);

    await expect(requestMayaMarketValue(url, options)).resolves.toBe(response);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(url, { ...options, timeout: 20_000 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries the same request after a temporary 503', async () => {
    const get = jest.spyOn(axios, 'get').mockRejectedValueOnce(httpError(503)).mockResolvedValue(response);

    await expect(requestMayaMarketValue(url, options)).resolves.toBe(response);
    expect(get.mock.calls).toStrictEqual(Array(2).fill([url, { ...options, timeout: 20_000 }]));
    expect(sleep.mock.calls).toStrictEqual([[1_000]]);
  });

  it('propagates the last error after two retries', async () => {
    const lastError = httpError(503);
    const get = jest.spyOn(axios, 'get')
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(lastError);

    await expect(requestMayaMarketValue(url, options)).rejects.toBe(lastError);
    expect(get).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toStrictEqual([[1_000], [2_000]]);
  });

  it.each([
    ['5', 5_000],
    ['Thu, 12 Nov 2026 19:00:07 GMT', 7_000],
    ['0', 1_000],
    ['invalid', 1_000],
  ])('chooses the delay for Retry-After %s', async (retryAfter, delay) => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-12T19:00:00Z'));
    jest.spyOn(axios, 'get').mockRejectedValueOnce(httpError(503, retryAfter)).mockResolvedValue(response);

    await expect(requestMayaMarketValue(url, options)).resolves.toBe(response);
    expect(sleep.mock.calls).toStrictEqual([[delay]]);
  });

  it('fails without retrying when the server requests a wait beyond the retry budget', async () => {
    const error = httpError(503, '30');
    const get = jest.spyOn(axios, 'get').mockRejectedValue(error);

    await expect(requestMayaMarketValue(url, options)).rejects.toBe(error);
    expect(get).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    httpError(404),
    new AxiosError('Request timed out', 'ECONNABORTED'),
    new Error('Unexpected error'),
  ])('propagates %s without retrying', async (error) => {
    const get = jest.spyOn(axios, 'get').mockRejectedValue(error);

    await expect(requestMayaMarketValue(url, options)).rejects.toBe(error);
    expect(get).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
