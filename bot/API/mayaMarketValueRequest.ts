import { setTimeout as sleep } from 'node:timers/promises';
import axios, { type AxiosRequestConfig } from 'axios';

const requestTimeoutMs = 20_000;
const retryDelaysMs = [1_000, 2_000];
const maxRetryDelayMs = 15_000;

function getRetryDelay(retryAfter: unknown, defaultDelayMs: number): number {
  if (typeof retryAfter !== 'string') {
    return defaultDelayMs;
  }

  const retryAfterMs = /^\d+$/.test(retryAfter)
    ? Number(retryAfter) * 1_000
    : Date.parse(retryAfter) - Date.now();
  return Number.isNaN(retryAfterMs) ? defaultDelayMs : Math.max(defaultDelayMs, retryAfterMs);
}

export default async function requestMayaMarketValue(url: string, options: AxiosRequestConfig) {
  const request = () => axios.get(url, { ...options, timeout: requestTimeoutMs });
  for (const delay of retryDelaysMs) {
    try {
      return await request();
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 503) {
        throw error;
      }
      const retryDelay = getRetryDelay(error.response.headers['retry-after'], delay);
      if (retryDelay > maxRetryDelayMs) {
        throw error;
      }
      await sleep(retryDelay);
    }
  }
  return request();
}
