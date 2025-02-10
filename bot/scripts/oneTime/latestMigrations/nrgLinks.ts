import 'dotenv/config';
import { asyncGeneratorMapWithSequence } from '../../../utilities';
import NewWikiApi, { IWikiApi } from '../../../wiki/NewWikiApi';

const oldLink = 'www.nrg.co.il/online/';
// eslint-disable-next-line max-len
const regex = /http:\/\/www\.nrg\.co\.il\/online\/((?:\d{1,5}|archive)\/ART(?:\d{1,5})?\/(?:\d{1,5}(?:\/\d{1,5})?)\.html)(?:\?hp=\d{1,3}&cat=\d{1,5}&loc=\d{1,5})?/ig;
const newLink = 'https://www.makorrishon.co.il/nrg/online/';

const pages: string[] = [];
const updatedPages: string[] = [];
const errorPages: string[] = [];

async function updateLinks(api: IWikiApi, protocol: 'http' | 'https') {
  await asyncGeneratorMapWithSequence(10, api.externalUrl(oldLink, protocol, '*'), (page) => async () => {
    pages.push(page.title);
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('No content for', page.title);
      return;
    }
    const revid = page.revisions?.[0].revid;
    if (!revid) {
      console.log('No revid for', page.title);
      return;
    }
    const newContent = content.replaceAll(regex, `${newLink}$1`);
    if (newContent === content) {
      console.log('no change', page.title);
      return;
    }
    try {
      await api.edit(page.title, 'תיקון קישורים לאתר nrg', newContent, revid);
      updatedPages.push(page.title);
    } catch (error) {
      errorPages.push(page.title);
      console.log(error?.data || error?.message || error?.toString());
    }
  });
}

export default async function nrgLinksFix() {
  const api = NewWikiApi();
  await api.login();
  await updateLinks(api, 'http');
  console.log('Pages:', pages.length);
  console.log('Updated:', updatedPages.length);
  console.log('Errors:', errorPages.length);
  console.log('Error pages:', errorPages.toString());
}
