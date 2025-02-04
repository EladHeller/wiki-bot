import shabathProtectorDecorator from '../decorators/shabathProtector';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../utilities';
import BaseWikiApi, { defaultConfig } from '../wiki/BaseWikiApi';
import NewWikiApi, { IWikiApi } from '../wiki/NewWikiApi';
import WikiDataAPI, { IWikiDataAPI } from '../wiki/WikidataAPI';
import {
  findTemplate, findTemplates, getTemplateArrayData, getTemplateKeyValueData,
} from '../wiki/newTemplateParser';

const CATEGORY_NAME = 'ערכים עם קישור שפה לערך שכבר קיים בעברית';
const LANGUAGE_LINKS_TEMPLATE = 'קישור שפה';

function getLinkText(template: string, articleName: string, presentName?: string) {
  const keyValueData = getTemplateKeyValueData(template);
  const addApostrophes = keyValueData['מירכאות']?.trim() === 'כן';
  const isPresentNameBold = presentName?.startsWith("'''") && presentName.endsWith("'''");
  const isPresentNameItalic = !isPresentNameBold && presentName?.startsWith("''") && presentName.endsWith("''");
  const startAndEnd = `${addApostrophes ? '"' : ''}${isPresentNameBold ? "'''" : ''}${isPresentNameItalic ? "''" : ''}`;
  return `${startAndEnd}[[${articleName}${presentName && (presentName !== articleName) ? `|${presentName}` : ''}]]${startAndEnd}`;
}

async function getLaunguagesCode(api: IWikiApi) {
  const res = await api.articleContent('תבנית:קוד שפה');
  const template = findTemplate(res.content, '#בחר:{{{1}}}', 'תבנית:קוד שפה');
  return getTemplateKeyValueData(template);
}

const languagesApiDict: Record<string, IWikiApi> = {};
const logs: string[] = [];
const alreadyChecked: Record<string, string> = {};

const statistics = {
  total: 0,
  updated: 0,
  totalTemplates: 0,
  templatesUpdated: 0,
  errors: 0,
  noLanguageCode: 0,
  failedRequests: 0,
  noWikiDataItem: 0,
  noHeWikiLink: 0,
  helinkIsRedirect: 0,
  noInfo: 0,
  updateWrongName: 0,
  noUpdated: [] as string[],
};

export async function parseContent(
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  title: string,
  content: string,
  languageCodesDict: Record<string, string>,
) {
  statistics.total += 1;
  const templates = findTemplates(content, LANGUAGE_LINKS_TEMPLATE, title);
  const newContent = content;
  let updated = false;
  await promiseSequence(1, templates.map((template) => async () => {
    try {
      statistics.totalTemplates += 1;
      updated = true;
      if (alreadyChecked[template]) {
        statistics.templatesUpdated += 1;
        // newContent = newContent.replaceAll(
        //   template,
        //   alreadyChecked[template],
        // );
        logs.push(`* [[${title}]]: ${template} -> ${alreadyChecked[template]}`);
        return;
      }
      const [language, externalName, articleName, presentName] = getTemplateArrayData(
        template,
        LANGUAGE_LINKS_TEMPLATE,
        title,
        true,
      );
      const languageCode = languageCodesDict[language || 'אנגלית'];
      if (!languageCode) {
        console.error('no language code', { title, template, language });
        statistics.noLanguageCode += 1;
        return;
      }
      if (!languagesApiDict[languageCode]) {
        languagesApiDict[languageCode] = NewWikiApi(BaseWikiApi({ ...defaultConfig, baseUrl: `https://${languageCode}.wikipedia.org/w/api.php`, assertBot: false }));
      }
      const languageApi = languagesApiDict[languageCode];
      const wikiDataItem = await languageApi.getWikiDataItem(externalName);
      if (!wikiDataItem) {
        statistics.noWikiDataItem += 1;
        return;
      }
      const wikiDataRes = await wikiDataApi.readEntity(wikiDataItem, 'sitelinks');
      if (!wikiDataRes) {
        statistics.noWikiDataItem += 1;
        return;
      }
      if (!wikiDataRes.sitelinks.hewiki?.title) {
        statistics.noHeWikiLink += 1;
        return;
      }
      const [infoRes] = await api.info([wikiDataRes.sitelinks.hewiki.title]);
      if (!infoRes || infoRes.missing != null) {
        statistics.noInfo += 1;
        return;
      }

      if (infoRes.redirect != null) {
        statistics.helinkIsRedirect += 1;
        return;
      }

      if (wikiDataRes.sitelinks.hewiki.title !== articleName) {
        statistics.updateWrongName += 1;
      }
      updated = true;
      statistics.templatesUpdated += 1;
      const newLinkText = getLinkText(template, wikiDataRes.sitelinks.hewiki.title, presentName || articleName);
      // newContent = newContent.replaceAll(
      //   template,
      //   getLinkText(template, wikiDataRes.sitelinks.hewiki.title, presentName || articleName),
      // );
      alreadyChecked[template] = newLinkText;
      logs.push(`* [[${title}]]: ${template} -> ${newLinkText}`);
    } catch (e) {
      console.log(e.message || e.data || e.toString());
      statistics.failedRequests += 1;
    }
  }));
  if (updated) {
    statistics.updated += 1;
  } else {
    statistics.noUpdated.push(title);
  }
  return newContent;
}

export default async function languageLinks() {
  const api = NewWikiApi();
  await api.login();
  const wikidataApi = WikiDataAPI();
  await wikidataApi.login();

  const languageCodesDict = await getLaunguagesCode(api);

  const generator = api.categroyPages(CATEGORY_NAME);

  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    console.log(`Checking ${page.title}`);
    const content = page.revisions?.[0].slots.main['*'];
    const revid = page.revisions?.[0].revid;
    if (!content) {
      console.error(`No content for ${page.title}`);
      return;
    }
    if (!revid) {
      console.error(`No revid for ${page.title}`);
      return;
    }

    const newContent = await parseContent(api, wikidataApi, page.title, content, languageCodesDict);
    if (newContent !== content) {
      console.log(`Updating ${page.title}!!!!!!!!!`);
      // await api.edit(page.title, 'הסרת תבנית קישור שפה', newContent, revid);
    }
  });
  const [sandboxInfo] = await api.info(['משתמש:החבלן/Sandbox']);
  if (!sandboxInfo?.lastrevid) {
    console.error('No sandbox info');
    return;
  }
  console.log(statistics);
  await api.edit('משתמש:החבלן/Sandbox', 'בדיקת קישורי שפה', logs.join('\n'), sandboxInfo.lastrevid);
}

export const main = shabathProtectorDecorator(languageLinks);
