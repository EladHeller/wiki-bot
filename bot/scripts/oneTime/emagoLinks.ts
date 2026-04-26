import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const webArchivePrefix = 'https://web.archive.org/web/20230403233921/';
const doubleWebArchiveRegex = /https:\/\/web\.archive\.org\/web\/\d+\/https:\/\/web\.archive\.org\/web\/\d+\//g;
const regex = /(http:\/\/www\.e-mago\.co\.il\/\w+)/g;
async function fixPage(api: IWikiApi, page: WikiPage) {
  const content = page.revisions?.[0].slots.main['*'];
  const revid = page.revisions?.[0].revid;
  if (!content || !revid) {
    console.error(`Missing content or revid for ${page.title}`);
    return;
  }

  let newContent = content.replaceAll(regex, `${webArchivePrefix}$1`);
  newContent = content.replaceAll(webArchivePrefix + webArchivePrefix, webArchivePrefix);
  newContent = content.replaceAll(webArchivePrefix + webArchivePrefix, webArchivePrefix);
  newContent = content.replaceAll(webArchivePrefix + webArchivePrefix, webArchivePrefix);
  newContent = content.replaceAll(webArchivePrefix + webArchivePrefix, webArchivePrefix);
  newContent = content.replaceAll(webArchivePrefix + webArchivePrefix, webArchivePrefix);
  newContent = content.replaceAll(doubleWebArchiveRegex, webArchivePrefix);
  newContent = content.replaceAll(doubleWebArchiveRegex, webArchivePrefix);
  newContent = content.replaceAll(doubleWebArchiveRegex, webArchivePrefix);
  newContent = content.replaceAll(doubleWebArchiveRegex, webArchivePrefix);

  if (newContent === content) {
    console.warn(`no change for page ${page.title}`);
    return;
  }

  await api.edit(page.title, 'תיקון קישור ל-emago באמצעות ארכיון האינטרנט ([[מיוחד:הבדל/43134422|בקשה בוק:בב]])', newContent, revid);
  console.log(`Fix ${page.title}`);
}

export default async function fixEmagoLinks() {
  const api = WikiApi();
  await api.login();

  //   const generator = api.externalUrl('www.e-mago.co.il', 'https');
  //   const generator1 = api.externalUrl('www.e-mago.co.il', 'http', '*');

  //   await asyncGeneratorMapWithSequence(1, generator, (page: WikiPage) => async () => fixPage(api, page));
  //   await asyncGeneratorMapWithSequence(50, generator1, (page: WikiPage) => async () => fixPage(api, page));
  const now = new Date();
  now.setHours(now.getHours() - 5);
  const generator = api.userContributes('sapper-bot', now, new Date());

  await asyncGeneratorMapWithSequence(1, generator, (contrib) => async () => {
    const { content, revid } = await api.articleContent(contrib.title);

    const page: WikiPage = {
      pageid: 1,
      ns: 0,
      title: contrib.title,
      extlinks: [],
      revisions: [
        {
          user: 'test',
          size: 100,
          revid,
          slots: {
            main: {
              contentmodel: 'wikitext',
              contentformat: 'text/x-wiki',
              '*': content,
            },
          },
        },
      ],
    };
    await fixPage(api, page);
  });
}
