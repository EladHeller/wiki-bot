import exaSearch from '../../API/exaSearchAPI';
import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage } from '../../utilities';
import createUrlRedirectChecker from '../../utilities/checkUrlRedirect';
import { getTemplateArrayData, templateFromArrayData, findTemplates } from '../../wiki/newTemplateParser';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';

process.env.NODE_ENV = 'development';

const TEMPLATE_NAME = 'וואלה';
const TEMPLATE_NAME1 = 'וואלה!';
const urlRegex = /https:\/\/([^.]+)\.walla\.co\.il\/([^/]+(?:\/[^/]+)?)\/(\d+)/i;
const searchEnabled = true;
const { checkUrlRedirect } = createUrlRedirectChecker(urlRegex);
function templateFromUrl(
  url: string,
  pageTitle: string,
  templateText: string,
  templateName: string,
) {
  const arrayData = getTemplateArrayData(templateText, templateName, pageTitle, true);
  const matches = url.match(urlRegex);
  if (!matches) {
    console.error(`Failed tp parse URL of ${pageTitle}`);
    return templateText;
  }
  const [, subdomain, slug] = matches;
  const isNotSubDomainSection = subdomain === 'www' && slug;

  arrayData[4] = isNotSubDomainSection ? slug : subdomain;
  return templateFromArrayData(arrayData, templateName);
}

function filterResults(results: {title: string | null, url: string}[], templateArrayData: string[]) {
  return results.find(({ title, url }) => {
    const matches = url.match(urlRegex);
    if (!matches) {
      return false;
    }
    const [, , , id] = matches;
    return id === templateArrayData[2] || title === templateArrayData[1];
  });
}

async function parseTemplate(api: IWikiApi, templateText: string, pageTitle: string, templateName: string) {
  const arrayData = getTemplateArrayData(templateText, templateName, pageTitle, true);
  if (arrayData.length > 4 && arrayData[4] !== '') {
    return templateText;
  }
  if (arrayData.length < 4) {
    console.error(`Parametere count lower then 4 ${pageTitle}`);
    return templateText;
  }

  const urls = [
    `https://www.walla.co.il/item/${arrayData[2]}`,
    `https://e.walla.co.il/item/${arrayData[2]}`,
    `https://www.walla.co.il/news/israel/${arrayData[2]}`,
    `https://sports.walla.co.il/item/${arrayData[2]}`,
    `https://finance.walla.co.il/item/${arrayData[2]}`,
    `https://www.walla.co.il/news/law/${arrayData[2]}`,
    `https://www.walla.co.il/news/military/${arrayData[2]}`,
    `https://www.walla.co.il/news/politics/${arrayData[2]}`,
    `https://www.walla.co.il/news/breaking-news/${arrayData[2]}`,
    `https://www.walla.co.il/news/environment-science/${arrayData[2]}`,
    `https://www.walla.co.il/news/world/${arrayData[2]}`,
    `https://fashion.walla.co.il/item/${arrayData[2]}`,
    `https://www.walla.co.il/celebs/local-news/${arrayData[2]}`,
  ];
  for (const url of urls) {
    const newUrl = await checkUrlRedirect(url);
    if (newUrl !== url) {
      return templateFromUrl(newUrl, pageTitle, templateText, templateName);
    }
  }
  if (!searchEnabled) {
    return templateText;
  }
  const searchResults = await exaSearch(arrayData[1]);
  const searchRes = filterResults(searchResults, arrayData);
  if (!searchRes) {
    console.error(`Failed to search title of ${pageTitle}`);
    return templateText;
  }
  const newSearchUrl = await checkUrlRedirect(searchRes.url);
  return templateFromUrl(newSearchUrl, pageTitle, templateText, templateName);
}

async function handlePage(api: IWikiApi, page: WikiPage) {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    throw new Error(`Missing revid or content for ${page.title}`);
  }
  let newContent = content;
  const templates = findTemplates(content, TEMPLATE_NAME, page.title);
  for (const template of templates) {
    const newTemplate = await parseTemplate(api, template, page.title, TEMPLATE_NAME);
    newContent = newContent.replace(template, newTemplate);
  }
  const templates1 = findTemplates(content, TEMPLATE_NAME1, page.title);
  for (const template of templates1) {
    const newTemplate = await parseTemplate(api, template, page.title, TEMPLATE_NAME1);
    newContent = newContent.replace(template, newTemplate);
  }
  if (content !== newContent) {
    console.log(`updating ${page.title}`);
    await api.edit(page.title, 'תיקון תבנית:וואלה בעקבות שינוי במבנה הכתובת ([[מיוחד:הבדל/44260017|בקשה בוק:בב]])', newContent, revid);
  }
}

export default async function wallaUrlChange() {
  const api = WikiApi();
  await api.login();

  const generator = api.categroyPages(
    'שגיאות פרמטריות בתבנית וואלה',
    50,
  );
  await asyncGeneratorMapWithSequence(3, generator, (page) => async () => {
    await handlePage(api, page);
  });
}
