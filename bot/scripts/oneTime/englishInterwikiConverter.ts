import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage, convertContentToWikiPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';

const BASE_SEARCH_PATTERN = '\\<small\\>\\s*\\(\\s*\\[\\[:en:';
const LINK_PATTERN = /<small>\s*\(\s*\[\[:en:([^\]|]+)\|אנ['׳]\]\]\s*\)\s*<\/small>/gi;
const SUMMARY = 'הסבת קישורים לוויקיפדיה האנגלית לתבנית {{אנ}}';

export function convertEnglishInterwikiLinks(content: string): string {
  return content.replace(LINK_PATTERN, (_text, foreignTitle: string) => `{{אנ|${foreignTitle.replace(/_/g, ' ')}}}`);
}

async function handlePage(api: IWikiApi, page: WikiPage): Promise<string | null> {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    return null;
  }

  const newContent = convertEnglishInterwikiLinks(content);
  if (newContent === content) {
    return null;
  }

  await api.edit(page.title, SUMMARY, newContent, revid);
  return page.title;
}

export async function checkPage(api: IWikiApi, title: string): Promise<void> {
  const { content, revid } = await api.articleContent(title);
  const page = convertContentToWikiPage(content, revid, title);
  await handlePage(api, page);
}

export default async function englishInterwikiConverter(api: IWikiApi): Promise<void> {
  const generator = api.search(`insource:/${BASE_SEARCH_PATTERN}/`, false, '0|14|100');
  await asyncGeneratorMapWithSequence(
    1,
    generator,
    (page) => async () => handlePage(api, page),
  );
}
