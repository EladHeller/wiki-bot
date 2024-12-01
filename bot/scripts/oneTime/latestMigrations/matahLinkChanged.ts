import 'dotenv/config';
import { asyncGeneratorMapWithSequence } from '../../../utilities';
import NewWikiApi, { IWikiApi } from '../../../wiki/NewWikiApi';

const oldLink = 'lib.cet.ac.il/Pages/';
// eslint-disable-next-line max-len
const regex = /https?:\/\/lib\.cet\.ac\.il\/Pages\/(\w{2,20})\.asp\?(\w{2,20}=\d{1,12})(&\w{2,20}=\d{1,12})?(&\w{2,20}=\d{1,12})?/ig;
const newLink = `https://www.${oldLink}`;

const pages: string[] = [];
const updatedPages: string[] = [];
const errorPages: string[] = [];

async function updateLinks(api: IWikiApi, protocol: 'http' | 'https') {
  await asyncGeneratorMapWithSequence(10, api.externalUrl(oldLink, protocol, '0|10'), (page) => async () => {
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
    const newContent = content.replaceAll(regex, `${newLink}$1.asp?$2$3$4`);
    if (newContent === content) {
      console.log('no change', page.title);
      return;
    }
    try {
      await api.edit(page.title, 'עדכון קישורים לאתר מט"ח', newContent, revid);
      updatedPages.push(page.title);
    } catch (error) {
      errorPages.push(page.title);
      console.log(error?.data || error?.message || error?.toString());
    }
  });
}

export default async function matahLinkChanged() {
  const api = NewWikiApi();
  await api.login();
  await updateLinks(api, 'http');
  await updateLinks(api, 'https');
  console.log('Pages:', pages.length);
  console.log('Updated:', updatedPages.length);
  console.log('Errors:', errorPages.length);
  console.log('Error pages:', errorPages.toString());
}
