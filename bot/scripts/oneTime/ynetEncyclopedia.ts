import { promiseSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';
import { WikiPage } from '../../types';

// const oldLink = 'www.ynet.co.il/yaan/';
async function ynetEncyclopedia() {
  const api = WikiApi();
  // old api
  // const httpPages = await api.externalUrl(oldLink, 'http');
  // const httpsPages = await api.externalUrl(oldLink, 'https');
  // const pages = [...httpPages, ...httpsPages];
  const pages: WikiPage[] = [];
  await promiseSequence(1, pages.map((page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (content && page.title) {
      let newContent = content;
      const refMatches = content.matchAll(
        /{{הערה\|\s*\[https?:\/\/www\.ynet\.co\.il\/yaan\/(?:[^ ]*) ([^\]]*)\][^}]+}}/g,
      );
      for (const match of refMatches) {
        newContent = newContent.replace(match[0], '');
      }
      const refTagMatches = content.matchAll(
        /<ref>\s*\[https?:\/\/www\.ynet\.co\.il\/yaan\/(?:[^ ]*) ([^\]]*)\][^<]+<\/ref>/g,
      );
      for (const match of refTagMatches) {
        newContent = newContent.replace(match[0], '');
      }
      const externalUrlMatches = content.matchAll(
        /\n\*.*\[https?:\/\/www\.ynet\.co\.il\/yaan\/(?:[^ ]*) ([^\]]*)\].*/g,
      );
      for (const match of externalUrlMatches) {
        newContent = newContent.replace(match[0], '');
      }
      const generalLink = content.matchAll(
        /{{הערה\|{{קישור כללי\|כתובת=https?:\/\/www\.ynet\.co\.il\/yaan\/(?:[^|]*)[^}]*}}[^}]*}}/g,
      );
      for (const match of generalLink) {
        newContent = newContent.replace(match[0], '');
      }
      const generalLinkInTag = content.matchAll(
        /<ref>{{קישור כללי\|כתובת=https?:\/\/www\.ynet\.co\.il\/yaan\/(?:[^|]*)[^}]*}}[^<]*<\/ref>/g,
      );
      for (const match of generalLinkInTag) {
        newContent = newContent.replace(match[0], '');
      }
      if (newContent === content) {
        console.log('no change', page.title);
        return;
      }
      try {
        await api.updateArticle(page.title, 'הסרת קישור לאנציקלופדיית ynet', newContent);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
      console.log(page.title);
    }
  }));
}

export default ynetEncyclopedia;
