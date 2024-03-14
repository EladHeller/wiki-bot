import { IWikiApi } from '../../wiki/NewWikiApi';
import { findTemplate, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { getParagraphContent } from '../../wiki/paragraphParser';

export interface IArchiveBotModel {
  updateArchiveTemplate(logPage: string): Promise<void>;
  archiveContent(logPage: string): Promise<void>;
}

type ArchiveConfig = {
  archiveTemplatePath: string;
  monthArchivePath: (monthAndYear: string) => string;
  archiveBoxTemplate: string;
  languageCode: string;
  logParagraphTitlePrefix: string;
  archiveTemplate: string;
};

const defaultConfig: ArchiveConfig = {
  archiveTemplatePath: '/ארכיונים',
  archiveBoxTemplate: 'תיבת ארכיון',
  monthArchivePath: (monthAndYear) => `ארכיון ${monthAndYear}`,
  languageCode: 'he-IL',
  logParagraphTitlePrefix: 'לוג ריצה ',
  archiveTemplate: 'ארכיון',
};

async function getContent(wikiApi: IWikiApi, title: string) {
  const content = await wikiApi.getArticleContent(title);
  if (!content) {
    throw new Error(`Missing content for ${title}`);
  }
  return content;
}

export default function ArchiveBotModel(wikiApi: IWikiApi, config: ArchiveConfig = defaultConfig): IArchiveBotModel {
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const monthAndYear = new Intl.DateTimeFormat(config.languageCode, { month: 'long', year: 'numeric' }).format(lastMonthDate);

  function getLastMonthTitle(logPage: string) {
    return `${logPage}/${config.monthArchivePath(monthAndYear)}`;
  }

  async function updateArchiveTemplate(logPage: string) {
    const archivePage = logPage + config.archiveTemplatePath;
    const archivePageContent = await getContent(wikiApi, archivePage);

    const year = lastMonthDate.getFullYear();
    const month = new Intl.DateTimeFormat(config.languageCode, { month: 'long' }).format(lastMonthDate);
    const lastMonthArchivePageLink = `[[${getLastMonthTitle(logPage)}|${month}]]`;
    const yearTitle = `'''${year}'''`;

    const archiveTemplateContent = findTemplate(archivePageContent, config.archiveBoxTemplate, archivePage);
    const [parameter] = getTemplateArrayData(archiveTemplateContent, config.archiveBoxTemplate, archivePage, true);
    let newParameter = parameter;
    if (!parameter.includes(yearTitle)) {
      newParameter += `\n* ${yearTitle}`;
    }
    if (!parameter.includes(lastMonthArchivePageLink)) {
      newParameter += `\n** ${lastMonthArchivePageLink}`;
    }

    if (newParameter === parameter) {
      return;
    }

    await wikiApi.updateArticle(archivePage, 'הוספת חודש נוכחי לתבנית ארכיון', archivePageContent.replace(parameter, newParameter));
  }

  async function archiveContent(logPage: string) {
    const content = await getContent(wikiApi, logPage);
    let text = '';
    let newContent = content;
    const dayDate = new Date(lastMonthDate);
    for (let i = 1; i <= 31; i += 1) {
      dayDate.setDate(i);
      if (dayDate.getMonth() === lastMonthDate.getMonth()) {
        const day = new Intl.DateTimeFormat(config.languageCode, { month: 'long', year: 'numeric', day: 'numeric' }).format(dayDate);
        const paragraphContent = getParagraphContent(newContent, config.logParagraphTitlePrefix + day);
        if (paragraphContent) {
          text += `==${config.logParagraphTitlePrefix}${day}==\n${paragraphContent}\n`;
          newContent = newContent
            .replace(paragraphContent, '')
            .replace(`\n== ${config.logParagraphTitlePrefix}${day} ==\n`, '')
            .replace(`\n==${config.logParagraphTitlePrefix}${day}==\n`, '');
        }
      }
    }
    await wikiApi.updateArticle(logPage, 'ארכוב', newContent);
    await wikiApi.updateArticle(getLastMonthTitle(logPage), 'ארכוב', `{{${config.archiveTemplate}}}\n${text}`);
  }

  return {
    updateArchiveTemplate,
    archiveContent,
  };
}
