import { IBaseWikiApi } from '../../bot/types';
import { Mocked } from './types';

export default function BaseWikiApiMock(base: Partial<Mocked<IBaseWikiApi>> = {}) : Mocked<IBaseWikiApi> {
  return {
    login: base.login ?? jest.fn(),
    request: base.request ?? jest.fn(),
    continueQuery: base.continueQuery ?? jest.fn(),
    getToken: base.getToken ?? jest.fn(),
  };
}
