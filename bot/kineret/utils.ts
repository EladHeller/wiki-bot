import { parseLocalDate } from '../utilities';
import WikiApi from '../wiki/WikiApi';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import { logger } from '../utilities/logger';

const dateFormater = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export interface LevelData {
    date: string;
    level: string;
}

export function formatDate(date: Date) {
  return dateFormater.format(date);
}

const DATE_LEVEL_FIELD = 'תאריך גובה';
const LEVEL_FIELD = 'גובה';
const CAHNGE_FIELD = 'שינוי';
const TEMPLATE_NAME = 'גוף מים';

function getChangeData(change: number) {
  if (change === 0) {
    return {
      text: 'ללא שינוי',
      icon: '[[File:Steady2.svg|11px]]',
    };
  }
  const number = Math.round(Math.abs(change * 1000)) / 10;

  if (change > 0) {
    return {
      text: `עלייה של ${number} ס"מ`,
      icon: '[[File:Increase2.svg|11px]]',
    };
  }
  return {
    text: `ירידה של ${number} ס"מ`,
    icon: '[[File:Decrease2.svg|11px]]',
  };
}

function datesDiffereceInDays(date1: Date, date2: Date) {
  if (date1 > date2) {
    logger.logError(`date1 must be before date2: ${date1} > ${date2}`);
    throw new Error('date1 must be before date2');
  }
  // {{הפרש תאריכים|יום1|חודש1|שנה1|יום2|חודש2|שנה2}}
  return `{{הפרש תאריכים|${date1.getDate()}|${date1.getMonth() + 1}|${date1.getFullYear()}|${date2.getDate()}|${date2.getMonth() + 1}|${date2.getFullYear()}}}`;
}

const api = WikiApi();

export async function updateLevel(
  levelData: LevelData,
  baseArticleName: string,
  templateName:string = TEMPLATE_NAME,
  dateLevelField:string = DATE_LEVEL_FIELD,
  levelField:string = LEVEL_FIELD,
) {
  await api.login();
  const { date, level } = levelData;
  const articleName = `${baseArticleName}/נתונים`;

  const contentResult = await api.articleContent(articleName);
  if (!contentResult) {
    throw new Error('Failed to get article content');
  }
  const { content, revid } = contentResult;
  const template = findTemplate(content, templateName, articleName);
  const oldTemplate = template;
  const templateData = getTemplateKeyValueData(template);
  if (!oldTemplate) {
    throw new Error('Failed to get template text');
  }

  const change = Number(level) - Number(templateData[LEVEL_FIELD]);
  const changeData = getChangeData(change);
  const oldDate = templateData[DATE_LEVEL_FIELD];
  const parsedOldDate = parseLocalDate(oldDate);
  const parsedDate = parseLocalDate(levelData.date);
  const today = new Date();

  if (today < parsedDate) {
    logger.logWarning(`Date ${date} is in the future`);
    return;
  }

  if (templateData[dateLevelField] === date || parsedOldDate > parsedDate) {
    console.log(`No update needed for ${articleName}`);
    return;
  }

  const newTemplateText = templateFromKeyValueData({
    ...templateData,
    [dateLevelField]: date,
    [levelField]: level,
    [CAHNGE_FIELD]: `${changeData.text} ${changeData.icon} מלפני ${datesDiffereceInDays(parsedOldDate, parsedDate)}`,
  }, templateName, true);
  const newContent = content.replace(oldTemplate, newTemplateText);

  await api.edit(articleName, 'עדכון מפלס', newContent, revid);

  await api.purge([baseArticleName]);
}
