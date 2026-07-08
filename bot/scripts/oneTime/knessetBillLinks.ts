import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import { WikiPage } from '../../types';

const OLD_LINK_QUERY = 'main.knesset.gov.il/activity/legislation/laws/pages/lawbill.aspx';
const SUMMARY = 'תיקון קישורים להצעות חוק באתר הכנסת';
// eslint-disable-next-line max-len
const oldKnessetBillUrlRegex = /https?:\/\/main\.knesset\.gov\.il\/activity\/legislation\/laws\/pages\/lawbill\.aspx\?[^ \]|}<\n]+/gi;
const supportedTypes = new Set(['lawsuggestionssearch', 'lawreshumot']);

function toNewKnessetBillUrl(value: string): string {
  const url = new URL(value.replaceAll('&amp;', '&'));
  const type = url.searchParams.get('t')?.toLowerCase();
  const lawItemId = url.searchParams.get('lawitemid');

  if (!type || !supportedTypes.has(type) || !lawItemId?.match(/^\d+$/)) {
    return value;
  }

  return `https://main.knesset.gov.il/apps/legislation/main/bills/${lawItemId}`;
}

export function fixKnessetBillLinksInContent(content: string): string {
  return content.replaceAll(oldKnessetBillUrlRegex, (url) => toNewKnessetBillUrl(url));
}

export async function processKnessetBillLinksPage(api: IWikiApi, page: WikiPage): Promise<boolean> {
  const { content, revid } = contentFromPage(page);

  if (!content || !revid) {
    console.log('No content or revid for', page.title);
    return false;
  }

  const newContent = fixKnessetBillLinksInContent(content);

  if (newContent === content) {
    console.log('no change', page.title);
    return false;
  }

  await api.edit(page.title, SUMMARY, newContent, revid);
  console.log('Fixed', page.title);
  return true;
}

async function updateLinks(api: IWikiApi, protocol: 'http' | 'https') {
  return asyncGeneratorMapWithSequence(
    50,
    api.externalUrl(OLD_LINK_QUERY, protocol, '*'),
    (page) => async () => processKnessetBillLinksPage(api, page),
  );
}

export default async function fixKnessetBillLinks() {
  const api = WikiApi();
  await api.login();
  await updateLinks(api, 'http');
  await updateLinks(api, 'https');
}
