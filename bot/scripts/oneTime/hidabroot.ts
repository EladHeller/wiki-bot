import { JSDOM } from 'jsdom';
import { asyncGeneratorMapWithSequence, contentFromPage, getLocalDate } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';
import { WikiPage } from '../../types';
import { getSchemaData } from '../../scraping';

const converted: string[] = [];
const all: string[] = [];
const BASE_LINK = 'www.hidabroot.org';
const TEMPLATE_NAME = 'הידברות';

async function getArticleData(url: string) {
  const dom = await JSDOM.fromURL(url);
  const schema = getSchemaData(dom.window.document, 'NewsArticle');
  if (!schema) {
    return null;
  }
  const date = schema.datePublished && getLocalDate(schema.datePublished);
  const title = schema.headline;
  const author = schema.author?.name;

  return {
    date, title, author,
  };
}

async function templateFromMatch(match: RegExpMatchArray) {
  const [, section, id, title] = match;
  if (!section || !id) {
    return null;
  }
  const url = `https://www.hidabroot.org/${section}/${id}`;
  const articleData = await getArticleData(url);
  const actualTitle = title || articleData?.title;
  if (!actualTitle) {
    console.error('no title');
    return null;
  }
  const author = articleData?.author || '';
  const date = articleData?.date || '';
  const actualSection = section !== 'article' ? section : '';
  const dateParameter = date ? `|${date}` : '';
  const lastParameters = actualSection ? `|${date}|${actualSection}` : dateParameter;
  return `{{${TEMPLATE_NAME}|${author}|${title}|${id}${lastParameters}}}`;
}
// https://www.hidabroot.org/{תחום}/000000
const urlRegex = 'https?:\\/\\/www\\.hidabroot\\.org\\/(video|program|question|writer|article|magazine/article_amp)\\/(\\d+)';

async function convert(page: WikiPage, api: IWikiApi) {
  all.push(page.title);
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    console.log(`No content for page ${page.title}`);
    return;
  }
  if (content && page.title) {
    let newContent = content;
    const refMatches = content
      .matchAll(new RegExp(`{{הערה\\|\\s*\\[${urlRegex}(?:\\?[^ ]+)? ([^\\]]*)\\][^}]+}}`, 'g'));
    for (const match of refMatches) {
      const newTemplate = await templateFromMatch(match);
      if (newTemplate) {
        newContent = newContent.replace(match[0], `{{הערה|${newTemplate}}}`);
      }
    }
    const refTagMatches = content
      .matchAll(new RegExp(`<ref>\\s*\\[${urlRegex}(?:\\?[^ ]+)? ([^\\]]*)\\][^<]+<\\/ref>`, 'g'));
    for (const match of refTagMatches) {
      const newTemplate = await templateFromMatch(match);
      if (newTemplate) {
        newContent = newContent.replace(match[0], `<ref>${newTemplate}</ref>`);
      }
    }
    const externalUrlMatches = content.matchAll(new RegExp(`\\n\\*\\[${urlRegex}(?:\\?[^ ]+)? ([^\\]]*)\\].*`, 'g'));
    for (const match of externalUrlMatches) {
      const newTemplate = await templateFromMatch(match);
      if (newTemplate) {
        newContent = newContent.replace(match[0], `\n* ${newTemplate}`);
      }
    }
    const generalLink = content
      .matchAll(new RegExp(`{{הערה\\|{{קישור כללי\\|כתובת=${urlRegex}(?:\\?[^}]+)?}}[^}]*}}`, 'g'));
    for (const match of generalLink) {
      const newTemplate = await templateFromMatch(match);
      if (newTemplate) {
        newContent = newContent.replace(match[0], `{{הערה|{{קישור כללי|כתובת=${newTemplate}}}}}`);
      }
    }
    const generalLinkInTag = content
      .matchAll(new RegExp(`<ref>{{קישור כללי\\|כתובת=${urlRegex}(?:\\?[^}]+)?}}[^<]*<\\/ref>`, 'g'));
    for (const match of generalLinkInTag) {
      const newTemplate = await templateFromMatch(match);
      if (newTemplate) {
        newContent = newContent.replace(match[0], `<ref>{{קישור כללי|כתובת=${newTemplate}}}</ref>`);
      }
    }
    if (newContent === content) {
      console.log('no change', page.title);
      return;
    }
    if (page.title === 'ט"ו באב (מועד)') {
      return;
    }
    try {
      await api.edit(page.title, 'הסבת קישור לתבנית הידברות', newContent, revid);
      converted.push(page.title);
    } catch (error) {
      console.log(error?.data || error?.message || error?.toString());
    }
    console.log(page.title);
  }
}

async function hidabroot(api: IWikiApi) {
  const httpGenerator = api.externalUrl(BASE_LINK, 'http');
  await asyncGeneratorMapWithSequence(1, httpGenerator, (page) => async () => convert(page, api));

  // const httpsGenerator = api.externalUrl(BASE_LINK, 'https');
  // await asyncGeneratorMapWithSequence(1, httpsGenerator, (page) => async () => convert(page, api));
  console.log(all.length);
  console.log(converted.length);
}

export default hidabroot;
