import { escapeRegex } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';
import { findTemplate, getTemplateArrayData } from '../../wiki/newTemplateParser';
import { getAllParagraphs, getParagraphContent } from '../../wiki/paragraphParser';

type ArchiveMode = 'titles' | 'signatureDate';

export interface IArchiveBotModel {
  updateArchiveTemplate(logPage: string): Promise<void>;
  archiveContent(logPage: string, archiveMode?: ArchiveMode): Promise<void>;
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

export const defaultConfig: ArchiveConfig = {
  archiveTemplatePath: '/ארכיונים',
  archiveBoxTemplate: 'תיבת ארכיון',
  monthArchivePath: (monthAndYear) => `ארכיון ${monthAndYear}`,
  languageCode: 'he-IL',
  logParagraphTitlePrefix: 'לוג ריצה ',
  archiveTemplate: 'ארכיון',
};

async function getContent(wikiApi: IWikiApi, title: string) {
  const result = await wikiApi.articleContent(title);
  if (!result.content) {
    throw new Error(`Missing content for ${title}`);
  }
  return result;
}

function getArchiveContentByTitles(archiveMonthDate: Date, config: ArchiveConfig, pageContent: string) {
  let text = '';
  const dayDate = new Date(archiveMonthDate);
  let newContent = pageContent;
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
  while (newContent.includes('\n\n\n')) {
    newContent = newContent.replace(/\n\n\n/g, '\n\n');
  }
  return { newContent, text };
}

function getArchiveContentBySignatureDate(
  archiveMonthDate: Date,
  config: ArchiveConfig,
  pageContent: string,
  pageTitle: string,
) {
  let text = '';
  const targetMonthName = new Intl.DateTimeFormat(config.languageCode, { month: 'long' }).format(archiveMonthDate);
  const targetYear = archiveMonthDate.getFullYear();

  const signatureRegex = new RegExp(
    String.raw`\b\d{1,2}:\d{2},\s+\d{1,2}\s+ב${escapeRegex(targetMonthName)}\s+${targetYear}\b`,
    'u',
  );

  let newContent = pageContent;
  const paragraphs = getAllParagraphs(pageContent, pageTitle);

  const paragraphsToArchive = paragraphs.filter((p) => signatureRegex.test(p));
  paragraphsToArchive.forEach((p) => {
    text += p;
    newContent = newContent.replace(p, '');
  });

  while (newContent.includes('\n\n\n')) {
    newContent = newContent.replace(/\n\n\n/g, '\n\n');
  }

  return { newContent, text };
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

    await wikiApi.edit(
      archivePage,
      'הוספת חודש נוכחי לתבנית ארכיון',
      archivePageContent.replace(parameter, newParameter),
      archivePageRevid,
    );
  }

  async function archiveContent(logPage: string, archiveMode: ArchiveMode = 'titles') {
    const { content, revid } = await getContent(wikiApi, logPage);

    const { newContent, text } = archiveMode === 'signatureDate'
      ? getArchiveContentBySignatureDate(archiveMonthDate, config, content, logPage)
      : getArchiveContentByTitles(archiveMonthDate, config, content);

    if (text === '') {
      return;
    }

    await wikiApi.create(getLastMonthTitle(logPage), `ארכוב ${month} ${year}`, `{{${config.archiveTemplate}}}\n${text}`);
    await wikiApi.edit(logPage, `ארכוב ${month} ${year}`, newContent, revid);
  }

  return {
    updateArchiveTemplate,
    archiveContent,
  };
}
