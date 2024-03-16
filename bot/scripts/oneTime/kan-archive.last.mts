import 'dotenv/config';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import NewWikiApi, { IWikiApi } from '../../wiki/NewWikiApi';
import { WikiPage } from '../../types';

const converted: string[] = [];
const all: string[] = [];
const BASE_LINK = 'archive.kan.org.il';
const TEMPLATE_NAME = 'כאן ארכיון';
const dateRegex = /\d{1,2} ב[א-ת]{3,10} \d{4}/;

function templateFromMatch(match: RegExpMatchArray) {
  const date = match[0].match(dateRegex)?.[0];

  return `{{${TEMPLATE_NAME}|${match[3]}|${match[1] ?? match[2]}${date ? `|${date}` : ''}}}`;
}

const urlRegex = 'https?:\\/\\/archive\\.kan\\.org\\.il\\/(?:[-a-zA-Z/]*(\\d+)|main\\/vod\\/([-a-zA-Z]+))\\/?';

async function convert(page: WikiPage, api: IWikiApi) {
  all.push(page.title);
  const content = page.revisions?.[0].slots.main['*'];
  if (content && page.title) {
    let newContent = content;
    const refMatches = content
      .matchAll(new RegExp(`{{הערה\\|\\s*\\[${urlRegex}(?:\\?[^ ]+)? ([^\\]]*)\\][^}]+}}`, 'g'));
    for (const match of refMatches) {
      newContent = newContent.replace(match[0], `{{הערה|${templateFromMatch(match)}}}`);
    }
    const refTagMatches = content
      .matchAll(new RegExp(`<ref>\\s*\\[${urlRegex}(?:\\?[^ ]+)? ([^\\]]*)\\][^<]+<\\/ref>`, 'g'));
    for (const match of refTagMatches) {
      newContent = newContent.replace(match[0], `<ref>${templateFromMatch(match)}</ref>`);
    }
    const externalUrlMatches = content.matchAll(new RegExp(`\\n\\*\\[${urlRegex}(?:\\?[^ ]+)? ([^\\]]*)\\].*`, 'g'));
    for (const match of externalUrlMatches) {
      newContent = newContent.replace(match[0], `\n* ${templateFromMatch(match)}`);
    }
    const generalLink = content
      .matchAll(new RegExp(`{{הערה\\|{{קישור כללי\\|כתובת=${urlRegex}(?:\\?[^}]+)?}}[^}]*}}`, 'g'));
    for (const match of generalLink) {
      newContent = newContent.replace(match[0], `{{הערה|{{קישור כללי|כתובת=${templateFromMatch(match)}}}}}`);
    }
    const generalLinkInTag = content
      .matchAll(new RegExp(`<ref>{{קישור כללי\\|כתובת=${urlRegex}(?:\\?[^}]+)?}}[^<]*<\\/ref>`, 'g'));
    for (const match of generalLinkInTag) {
      newContent = newContent.replace(match[0], `<ref>{{קישור כללי|כתובת=${templateFromMatch(match)}}}</ref>`);
    }
    if (newContent === content) {
      console.log('no change', page.title);
      return;
    }
    try {
      await api.updateArticle(page.title, 'המרת קישור לתבנית:כאן ארכיון', newContent);
      converted.push(page.title);
    } catch (error) {
      console.log(error?.data || error?.message || error?.toString());
    }
    console.log(page.title);
  }
}

async function kanArchive() {
  const api = NewWikiApi();
  await api.login();
  const httpGenerator = api.externalUrl(BASE_LINK, 'http');
  await asyncGeneratorMapWithSequence(1, httpGenerator, (page) => async () => convert(page, api));

  const httpsGenerator = api.externalUrl(BASE_LINK, 'https');
  await asyncGeneratorMapWithSequence(1, httpsGenerator, (page) => async () => convert(page, api));
  console.log(all.length);
  console.log(converted.length);
}

export default kanArchive;
