import BaseWikiApi, { defaultConfig } from '../wiki/BaseWikiApi';
import WikiApi from '../wiki/WikiApi';

// eslint-disable-next-line no-empty-function
async function main() {
  const baseWiki = BaseWikiApi({
    ...defaultConfig,
    assertBot: false,
    baseUrl: 'https://he.wikisource.org/w/api.php',
  });

  const api = WikiApi(baseWiki);
  const { content } = await api.articleContent('קטגוריה:אסתר_ט_יט');
  console.log(content);
}
main();
