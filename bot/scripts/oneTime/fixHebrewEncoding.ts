import WikiApi from '../../wiki/WikiApi';
import { asyncGeneratorMapWithSequence } from '../../utilities';

const encodingLinkText = '%d7%';
// const encodingLinkText = '%D7%';

function checkUrl(url: string) {
  return fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en-US,en;q=0.9,de;q=0.8,he;q=0.7,uk;q=0.6',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      priority: 'u=0, i',
      'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      'sec-ch-ua-arch': '"arm"',
      'sec-ch-ua-bitness': '"64"',
      'sec-ch-ua-full-version': '"134.0.6998.89"',
      'sec-ch-ua-full-version-list': '"Chromium";v="134.0.6998.89", "Not:A-Brand";v="24.0.0.0", "Google Chrome";v="134.0.6998.89"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-model': '""',
      'sec-ch-ua-platform': '"macOS"',
      'sec-ch-ua-platform-version': '"15.3.2"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      Referrer: 'https://www.google.com',
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: null,
    method: 'GET',
  });
}

async function handleLink(link: string): Promise<string> {
  let newLink = link;
  try {
    const matches = link.match(/(%d7%[9aA][0-9a-fA-F])/gi);
    if (!matches) {
      return link;
    }
    const resultBefore = await checkUrl(link);
    if (resultBefore.status < 200 || resultBefore.status >= 400) {
      console.warn(`The link ${link} failed`);
      return link;
    }
    for (const match of matches) {
      newLink = newLink.replace(match, decodeURIComponent(match));
    }

    const resultAfter = await checkUrl(newLink);
    if (resultAfter.status !== resultBefore.status) {
      console.log(`Result before status is ${resultBefore.status} and result after status is ${resultAfter.status}`);
      return link;
    }
    if (resultAfter.url.toLocaleLowerCase() !== resultBefore.url.toLocaleLowerCase()) {
      console.log(`Result before url is ${resultBefore.url} and result after url is ${resultAfter.url}`);
      return link;
    }
    return newLink;
  } catch (e) {
    console.log(e?.message || e?.toString());
    return link;
  }
}

export default async function fixHebrewEncoding() {
  const api = WikiApi();
  await api.login();
  const generartor = api.search(encodingLinkText);

  await asyncGeneratorMapWithSequence(25, generartor, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!content || !revid) {
      console.log(page.title, !content ? 'Missing content ' : '', !revid ? 'Missing revid' : '');
      throw new Error('Missing content or revid');
    }
    const links = content.match(/https?:\/\/[^}| <\]\n\t]+/ig) ?? [] satisfies string[];
    let newContent = content;
    for (const link of links) {
      const newLink = await handleLink(link);
      newContent = newContent.replaceAll(link, newLink);
    }

    if (newContent === content) {
      return;
    }
    try {
      console.log(`Updateing ${page.title}`);
      await api.edit(page.title, 'קידוד קישור', newContent, revid);
    } catch (error) {
      console.log(error?.data || error?.message || error?.toString());
    }
  });
}
