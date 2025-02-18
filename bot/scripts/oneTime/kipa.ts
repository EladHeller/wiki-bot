import { promiseSequence } from '../../utilities';
import { findTemplates } from '../../wiki/newTemplateParser';
import { WikiPage } from '../../types';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

const TEMPLATE_NAME = 'כיפה';
const url = 'https://www.kipa.co.il/';

async function getArticleWithKipaTemplate(api: IWikiApi): Promise<WikiPage[]> {
  const template = encodeURIComponent('תבנית:כיפה');
  const props = encodeURIComponent('revisions');
  const rvprops = encodeURIComponent('content');
  const path = '?action=query&format=json'
  // Pages with כיפה'
  + `&generator=embeddedin&geinamespace=0&geilimit=5000&geititle=${template}`
  + `&prop=${props}`
  // Get content of page
  + `&rvprop=${rvprops}&rvslots=*`;
  let pages: WikiPage[] = [];
  let result = await api.request(path);
  const firstResult = Object.values(result.data.query.pages) satisfies WikiPage[];
  pages = firstResult;
  while (result.data.continue) {
    result = await api.request(`${path}&elcontinue=${result.data.continue.elcontinue}&rvcontinue=${result.data.continue.rvcontinue}&continue=${result.data.continue.continue}`);
    pages = pages.concat(Object.values(result.data.query.pages));
  }
  const finalResults = pages.filter((page) => page.revisions?.[0]?.slots.main['*'].includes('{{כיפה'));
  firstResult.forEach((page) => {
    if (!finalResults.find((p) => p.pageid === page.pageid)) {
      console.log(page.title);
    }
  });
  return finalResults;
}

async function fixParameters(content: string, title: string): Promise<string> {
  let newContent = content;
  const templates = findTemplates(content, TEMPLATE_NAME, title);
  if (!templates.length) {
    console.log('no template', title);
  }
  await Promise.all(templates.map(async (template) => {
    const parameters = template.replace(`{{${TEMPLATE_NAME}|`, '').replace('}}', '').split('|');
    if (parameters[2].match(/^[0-9a-zA-Z]+(?:\/[0-9a-zA-Z]*)+$/)) {
      const res = await fetch(`${url}${parameters[2]}${!parameters[2].startsWith('ask') ? '.html' : ''}`);
      const newUrl = decodeURIComponent(res.url.replace(url, ''));
      if (newUrl) {
        parameters[2] = decodeURIComponent(res.url.replace(url, ''));
        newContent = newContent.replace(template, `{{${TEMPLATE_NAME}|${parameters.join('|')}}}`);
      } else {
        console.log('no new url', title);
      }
    }
  }));
  return newContent;
}

async function main() {
  const api = WikiApi();
  await api.login();
  const results = await getArticleWithKipaTemplate(api);
  console.log(results.length);

  await promiseSequence(10, results.map((result) => async () => {
    try {
      const content = result.revisions?.[0].slots.main['*'];
      const revid = result.revisions?.[0].revid;
      if (!content || !result.title || !revid) {
        console.log('no content or revid', result.title, { revid });
        return;
      }
      const newContent = await fixParameters(content, result.title);
      if (newContent === content) {
        return;
      }
      await api.edit(result.title, 'תיקון פרמטרים לתבנית כיפה', newContent, revid);
      console.log(result.title, 'updated');
    } catch (error) {
      console.log(result.title, error?.data || error?.message || error?.toString());
    }
  }));
}

main();
