import { jest } from '@jest/globals';
import { IBaseWikiApi } from '../../bot/types';
import { Mocked } from './types';

export default function BaseWikiApiMock(base: Partial<Mocked<IBaseWikiApi>> = {}) : Mocked<IBaseWikiApi> {
  return {
    login: base.login ?? jest.fn<() => Promise<string>>(),
    request: base.request ?? jest.fn<(path: string, method?: string, data?: Record<string, any>) => Promise<any>>(),
    continueQuery: base.continueQuery ?? jest.fn<(path: string,
      resultConverterCallback?: (result: any) => any,
       baseContinue?: Record<string, any>
    ) => AsyncGenerator<any, any, void>>(),
    getToken: base.getToken ?? jest.fn<(tokenType?: string) => Promise<Record<string, string>>>(),
  };
}
