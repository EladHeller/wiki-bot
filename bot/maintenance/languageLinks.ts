import { getLogTitleData } from '../admin/log';
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
const LOG_PAGE_NAME = 'ויקיפדיה:בוט/הסרת קישורי שפה';

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

type FailedReason = 'no language code' | 'no wiki data item' | 'no he wiki link' | 'he link is redirect' | 'missing language link';

export type LanguageLinkLog = {
  title: string;
  externalLink: string;
  template: string;
  success: boolean;
  newLink?: string;
  failedReason?: FailedReason;
};

const languagesApiDict: Record<string, IWikiApi> = {};
const logs: LanguageLinkLog[] = [];
const alreadyChecked: Record<string, string> = {};

const statistics = {
  total: 0,
  updated: 0,
  totalTemplates: 0,
  templatesUpdated: 0,
  externalRedirects: 0,
  // noLanguageCode: 0,
  failedRequests: 0,
  // noWikiDataItem: 0,
  // noHeWikiLink: 0,
  // helinkIsRedirect: 0,
  noInfo: 0,
  updateWrongName: 0,
  noUpdated: [] as string[],
};

export async function wrightLogs(api: IWikiApi, allLogs = logs) {
  const { content, revid } = await api.articleContent(LOG_PAGE_NAME);
  const { title, titleAndSummary } = getLogTitleData(content);

  const logContent = allLogs.map((log) => {
    const failed = log.success ? '' : ` (${log.failedReason}){{כ}}`;
    return `* ${log.title}:{{כ}} ${log.template} -{{כ}} ${log.externalLink} -{{כ}} ${log.success ? 'הצליח' : 'נכשל'}${failed}${log.newLink ? ` - ${log.newLink}` : ''}`;
  }).join('\n');

  await api.edit('ויקיפדיה:בוט/הסרת קישורי שפה', titleAndSummary, logContent, revid, title);
}

export async function parseContent(
  api: IWikiApi,
  wikiDataApi: IWikiDataAPI,
  title: string,
  content: string,
  languageCodesDict: Record<string, string>,
) {
  statistics.total += 1;
  const templates = findTemplates(content, LANGUAGE_LINKS_TEMPLATE, title);
  let newContent = content;
  await promiseSequence(1, templates.map((template) => async () => {
    try {
      statistics.totalTemplates += 1;
      const [language, externalName, articleName, presentName] = getTemplateArrayData(
        template,
        LANGUAGE_LINKS_TEMPLATE,
        title,
        true,
      );
      const languageCode = languageCodesDict[language || 'אנגלית']
        ?? (Object.values(languageCodesDict).includes(language) ? language : null);

      if (alreadyChecked[template]) {
        statistics.templatesUpdated += 1;
        newContent = newContent.replaceAll(
          template,
          alreadyChecked[template],
        );
        logs.push({
          title: `[[${title}]]`,
          template: `<nowiki>${template}</nowiki>`,
          externalLink: `[[:${languageCode}:${externalName}]]`,
          success: true,
          newLink: alreadyChecked[template],
        });
        return;
      }

      if (!languageCode) {
        logs.push({
          title: `[[${title}]]`,
          template: `<nowiki>${template}</nowiki>`,
          externalLink: `[[:${languageCode}:${externalName}]]`,
          success: false,
          failedReason: 'no language code',
        });
        // statistics.noLanguageCode += 1;
        return;
      }
      if (!languagesApiDict[languageCode]) {
        languagesApiDict[languageCode] = NewWikiApi(BaseWikiApi({ ...defaultConfig, baseUrl: `https://${languageCode}.wikipedia.org/w/api.php`, assertBot: false }));
      }
      const languageApi = languagesApiDict[languageCode];
      let wikiDataItem = await languageApi.getWikiDataItem(externalName);
      if (!wikiDataItem) {
        const target = await languageApi.getRedirecTarget(externalName);
        if (target?.missing != null) {
          logs.push({
            title: `[[${title}]]`,
            template: `<nowiki>${template}</nowiki>`,
            externalLink: `[[:${languageCode}:${externalName}]]`,
            success: false,
            failedReason: 'missing language link',
          });
          return;
        }
        if (target?.title) {
          wikiDataItem = await languageApi.getWikiDataItem(target.title);
        }
        if (!wikiDataItem) {
          logs.push({
            title: `[[${title}]]`,
            template: `<nowiki>${template}</nowiki>`,
            externalLink: `[[:${languageCode}:${externalName}]]`,
            success: false,
            failedReason: 'no wiki data item',
          });
          return;
        }
        statistics.externalRedirects += 1;
      }
      const wikiDataRes = await wikiDataApi.readEntity(wikiDataItem, 'sitelinks');
      if (!wikiDataRes) {
        logs.push({
          title: `[[${title}]]`,
          template: `<nowiki>${template}</nowiki>`,
          externalLink: `[[:${languageCode}:${externalName}]]`,
          success: false,
          failedReason: 'no wiki data item',
        });
        return;
      }
      if (!wikiDataRes.sitelinks?.hewiki?.title) {
        const [originHeLinkInfo] = await api.info([articleName]);
        if (originHeLinkInfo?.missing == null) {
          logs.push({
            title: `[[${title}]]`,
            template: `<nowiki>${template}</nowiki>`,
            externalLink: `[[:${languageCode}:${externalName}]]`,
            success: false,
            failedReason: 'no he wiki link',
          });
        }
        // statistics.noHeWikiLink += 1;
        return;
      }
      const [infoRes] = await api.info([wikiDataRes.sitelinks.hewiki.title]);
      if (!infoRes || infoRes.missing != null) {
        statistics.noInfo += 1;
        return;
      }

      if (infoRes.redirect != null) {
        logs.push({
          title: `[[${title}]]`,
          template: `<nowiki>${template}</nowiki>`,
          externalLink: `[[:${languageCode}:${externalName}]]`,
          newLink: `[[${wikiDataRes.sitelinks.hewiki.title}]]`,
          success: false,
          failedReason: 'he link is redirect',
        });
        return;
      }

      if (wikiDataRes.sitelinks.hewiki.title !== articleName) {
        statistics.updateWrongName += 1;
      }
      statistics.templatesUpdated += 1;
      const newLinkText = getLinkText(template, wikiDataRes.sitelinks.hewiki.title, presentName || articleName);
      newContent = newContent.replaceAll(
        template,
        getLinkText(template, wikiDataRes.sitelinks.hewiki.title, presentName || articleName),
      );
      alreadyChecked[template] = newLinkText;
      logs.push({
        title: `[[${title}]]`,
        template: `<nowiki>${template}</nowiki>`,
        externalLink: `[[:${languageCode}:${externalName}]]`,
        success: true,
        newLink: newLinkText,
      });
    } catch (e) {
      console.log(e.message || e.data || e.toString());
      statistics.failedRequests += 1;
    }
  }));

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
      statistics.updated += 1;
      // console.log(`Updating ${page.title}!!!!!!!!!`);
      await api.edit(page.title, 'החלפת תבנית קישור שפה בקישור פנימי', newContent, revid);
    } else {
      // console.log(`No update for ${page.title}`);
      statistics.noUpdated.push(page.title);
    }
  });
  console.log(statistics);
  await wrightLogs(api);
}

export const main = shabathProtectorDecorator(languageLinks);
