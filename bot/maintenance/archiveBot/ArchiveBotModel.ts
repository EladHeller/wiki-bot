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
  archiveMonthDate?: Date;
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
  const result = await wikiApi.articleContent(title);
  if (!result) {
    throw new Error(`Missing content for ${title}`);
  }
  return result;
}

export default function ArchiveBotModel(wikiApi: IWikiApi, config: ArchiveConfig = defaultConfig): IArchiveBotModel {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const archiveMonthDate = config.archiveMonthDate ?? lastMonth;
  const monthAndYear = new Intl.DateTimeFormat(config.languageCode, { month: 'long', year: 'numeric' }).format(archiveMonthDate);
  const month = new Intl.DateTimeFormat(config.languageCode, { month: 'long' }).format(archiveMonthDate);
  const year = archiveMonthDate.getFullYear();
  function getLastMonthTitle(logPage: string) {
    return `${logPage}/${config.monthArchivePath(monthAndYear)}`;
  }

  async function updateArchiveTemplate(logPage: string) {
    const archivePage = logPage + config.archiveTemplatePath;
    const { content: archivePageContent, revid: archivePageRevid } = await getContent(wikiApi, archivePage);

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

    await wikiApi.edit(archivePage, 'הוספת חודש נוכחי לתבנית ארכיון', archivePageContent.replace(parameter, newParameter), archivePageRevid);
  }

  async function archiveContent(logPage: string) {
    const { content, revid } = await getContent(wikiApi, logPage);
    let text = '';
    let newContent = content;
    const dayDate = new Date(archiveMonthDate);
    for (let i = 1; i <= 31; i += 1) {
      dayDate.setDate(i);
      if (dayDate.getMonth() === archiveMonthDate.getMonth()) {
        const day = new Intl.DateTimeFormat(config.languageCode, { month: 'long', year: 'numeric', day: 'numeric' }).format(dayDate);
        const paragraphContent = getParagraphContent(newContent, config.logParagraphTitlePrefix + day);
        if (paragraphContent) {
          text += `==${config.logParagraphTitlePrefix}${day}==\n${paragraphContent}\n`;
          newContent = newContent
            .replace(paragraphContent, '\n')
            .replace(`\n== ${config.logParagraphTitlePrefix}${day} ==\n`, '')
            .replace(`\n==${config.logParagraphTitlePrefix}${day}==\n`, '');
        }
      }
    }
    if (text === '') {
      return;
    }
    while (newContent.includes('\n\n\n')) {
      newContent = newContent.replace(/\n\n\n/g, '\n\n');
    }
    await wikiApi.create(getLastMonthTitle(logPage), `ארכוב ${month} ${year}`, `{{${config.archiveTemplate}}}\n${text}`);
    await wikiApi.edit(logPage, `ארכוב ${month} ${year}`, newContent, revid);
  }

  return {
    updateArchiveTemplate,
    archiveContent,
  };
}
