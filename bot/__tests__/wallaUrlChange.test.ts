import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';

const checkUrlRedirect = jest.fn<(url: string) => Promise<string>>();
const exaSearch = jest.fn<(title: string, domain: string) => Promise<{ title: string | null, url: string }[]>>();
const edit = jest.fn<(title: string, summary: string, text: string, revid: number) => Promise<void>>();
const login = jest.fn<() => Promise<void>>();
const categroyPages = jest.fn();
let content: string;

jest.unstable_mockModule('../utilities/checkUrlRedirect', () => ({
  default: () => ({ checkUrlRedirect }),
}));
jest.unstable_mockModule('../API/exaSearchAPI', () => ({ default: exaSearch }));
jest.unstable_mockModule('../wiki/WikiApi', () => ({
  default: () => ({ login, categroyPages, edit }),
}));
jest.unstable_mockModule('../utilities', () => ({
  contentFromPage: () => ({ content, revid: 1 }),
  asyncGeneratorMapWithSequence: async (
    _sequence: number,
    _generator: unknown,
    callback: (page: { title: string }) => () => Promise<void>,
  ) => callback({ title: 'Test page' })(),
}));

const { default: wallaUrlChange } = await import('../scripts/oneTime/wallaUrlChange');

const urls = [
  'https://e.walla.co.il/item/123',
  'https://news.walla.co.il/israel/123',
  'https://news.walla.co.il/law/123',
  'https://finance.walla.co.il/item/123',
];

describe('wallaUrlChange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    content = '{{וואלה|Author|Article title|123|Date}}';
    checkUrlRedirect.mockImplementation(async (url) => url);
    exaSearch.mockResolvedValue([]);
  });

  it.each(urls)('uses a redirect from %s before searching', async (candidate) => {
    urls.slice(0, urls.indexOf(candidate)).forEach((url) => checkUrlRedirect.mockResolvedValueOnce(url));
    checkUrlRedirect.mockResolvedValueOnce('https://news.walla.co.il/item/123');

    await wallaUrlChange();

    expect(checkUrlRedirect.mock.calls.map(([url]) => url)).toStrictEqual(urls.slice(0, urls.indexOf(candidate) + 1));
    expect(exaSearch).not.toHaveBeenCalled();
    expect(edit).toHaveBeenCalledWith(
      'Test page',
      expect.any(String),
      '{{וואלה|Author|Article title|123|Date|news}}',
      1,
    );
  });

  it('searches only after all candidate URLs fail to redirect', async () => {
    exaSearch.mockImplementation(async () => {
      expect(checkUrlRedirect.mock.calls.map(([url]) => url)).toStrictEqual(urls);

      return [{ title: 'Article title', url: 'https://finance.walla.co.il/item/123' }];
    });

    await wallaUrlChange();

    expect(exaSearch).toHaveBeenCalledWith('Article title', 'walla.co.il');
    expect(edit).toHaveBeenCalledWith(
      'Test page',
      expect.any(String),
      '{{וואלה|Author|Article title|123|Date|finance}}',
      1,
    );
  });

  it.each(['וואלה', 'וואלה!'])('updates the %s template using a www section URL', async (name) => {
    content = `{{${name}|Author|Article title|123|Date}}`;
    checkUrlRedirect.mockResolvedValue('https://www.walla.co.il/news/israel/123');

    await wallaUrlChange();

    expect(edit).toHaveBeenCalledWith('Test page', expect.any(String), `{{${name}|Author|Article title|123|Date|news/israel}}`, 1);
  });

  it.each([
    '{{וואלה|Author|Article title|123|Date|news}}',
    '{{וואלה|Author|Article title|123}}',
  ])('keeps templates with an unsupported parameter count: %s', async (template) => {
    content = template;

    await wallaUrlChange();

    expect(checkUrlRedirect).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
  });

  it('keeps the template when a redirected URL cannot be parsed', async () => {
    checkUrlRedirect.mockResolvedValue('https://www.example.com');

    await wallaUrlChange();

    expect(edit).not.toHaveBeenCalled();
    expect(exaSearch).not.toHaveBeenCalled();
  });

  it('ignores invalid and unrelated search results', async () => {
    exaSearch.mockResolvedValue([
      { title: 'Article title', url: 'https://example.com/123' },
      { title: null, url: 'https://news.walla.co.il/item/456' },
    ]);

    await wallaUrlChange();

    expect(edit).not.toHaveBeenCalled();
  });

  it('accepts a search result with a matching title and a different ID', async () => {
    exaSearch.mockResolvedValue([{ title: 'Article title', url: 'https://news.walla.co.il/item/456' }]);

    await wallaUrlChange();

    expect(edit).toHaveBeenCalledWith('Test page', expect.any(String), '{{וואלה|Author|Article title|123|Date|news}}', 1);
  });

  it('rejects a page without content', async () => {
    content = '';

    await expect(wallaUrlChange()).rejects.toThrow('Missing revid or content for Test page');
  });
});
