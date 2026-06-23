import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const mockLogin = jest.fn<() => Promise<void>>();
const mockExternalUrl = jest.fn();
const mockWikiApi = jest.fn();
const mockAsyncGeneratorMapWithSequence = jest.fn<any>();

jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: mockWikiApi,
}));

jest.unstable_mockModule('../utilities', () => ({
  asyncGeneratorMapWithSequence: mockAsyncGeneratorMapWithSequence,
}));

const { default: fixKnessetBillLinks } = await import('../scripts/oneTime/knessetBillLinks');

describe('fixKnessetBillLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue();
    mockExternalUrl.mockImplementation(async function* generator() {
      yield* [];
    });
    mockAsyncGeneratorMapWithSequence.mockImplementation(
      async (_sequenceSize: number, _generator: unknown, callback) => {
        await callback({
          pageid: 1, ns: 0, title: 'ערך', extlinks: [],
        })();
        return [];
      },
    );
    mockWikiApi.mockReturnValue({
      login: mockLogin,
      externalUrl: mockExternalUrl,
    });
  });

  it('should scan http and https old Knesset bill links', async () => {
    await fixKnessetBillLinks();

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockExternalUrl).toHaveBeenCalledWith(
      'main.knesset.gov.il/activity/legislation/laws/pages/lawbill.aspx',
      'http',
      '*',
    );
    expect(mockExternalUrl).toHaveBeenCalledWith(
      'main.knesset.gov.il/activity/legislation/laws/pages/lawbill.aspx',
      'https',
      '*',
    );
    expect(mockAsyncGeneratorMapWithSequence).toHaveBeenCalledTimes(2);
  });
});
