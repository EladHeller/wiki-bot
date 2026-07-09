import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';

const SEARCH_PATTERN = '\\[\\[([^]]+)\\]\\]\\s*\\<small\\>\\(\\[\\[:en:([^]|]+)\\|אנ\'\\]\\]\\)\\s*\\<\\/small\\>';
const regex = new RegExp(SEARCH_PATTERN.replaceAll('^]', '^\\]'), 'gi');

const SUMMARY = 'הסבת קישורי בינוויקי לתבנית קישור שפה';

async function handlePage(api: IWikiApi, page: WikiPage) {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    console.error('no content or revid', page.title);
    return;
  }
  const matches = content?.matchAll(regex);
  if (!matches) {
    console.error(page.title, 'no matches');
    return;
  }
  let newContent = content;
  for (const match of matches) {
    const [text, hebrewTitle, englishTitle] = match;
    if (hebrewTitle && englishTitle) {
      const normalizedEnglishTitle = decodeURIComponent(englishTitle.replace(/:en:/i, '').replace(/_/g, ' '));
      newContent = newContent.replace(text, `{{קישור שפה|אנגלית|${normalizedEnglishTitle}|${hebrewTitle}}}`);
    }
  }
  if (newContent !== content) {
    await api.edit(page.title, SUMMARY, newContent, revid);
  }
}

export default async function interwikiConverter(api: IWikiApi) {
  const generator = api.search(`insource:/${SEARCH_PATTERN}/`);

  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    await handlePage(api, page);
  });
}
