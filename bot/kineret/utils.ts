import { parseLocalDate } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import WikiTemplateParser from '../wiki/WikiTemplateParser';

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
  // {{הפרש תאריכים|יום1|חודש1|שנה1|יום2|חודש2|שנה2}}
  return `{{הפרש תאריכים|${date1.getDate()}|${date1.getMonth() + 1}|${date1.getFullYear()}|${date2.getDate()}|${date2.getMonth() + 1}|${date2.getFullYear()}}}`;
}

const api = NewWikiApi();

export async function updateLevel(
  levelData: LevelData,
  articleName: string,
  templateName:string = TEMPLATE_NAME,
  dateLevelField:string = DATE_LEVEL_FIELD,
  levelField:string = LEVEL_FIELD,
) {
  await api.login();
  const { date, level } = levelData;

  const content = await api.getArticleContent(articleName);
  if (!content) {
    throw new Error('Failed to get article content');
  }
  const template = new WikiTemplateParser(content, templateName);
  const oldTemplate = template.templateText;
  if (!oldTemplate) {
    throw new Error('Failed to get template text');
  }

  if (template.templateData[dateLevelField] === date) {
    console.log('No update needed');
    return;
  }

  const change = Number(level) - Number(template.templateData[LEVEL_FIELD]);
  const changeData = getChangeData(change);
  const oldDate = template.templateData[DATE_LEVEL_FIELD];
  const parsedOldDate = parseLocalDate(oldDate);
  const parsedDate = parseLocalDate(levelData.date);

  const newTemplateText = template.updateTamplateFromData({
    ...template.templateData,
    [dateLevelField]: date,
    [levelField]: level,
    [CAHNGE_FIELD]: `${changeData.text} ${changeData.icon} מלפני ${datesDiffereceInDays(parsedOldDate, parsedDate)}`,
  });
  const newContent = content.replace(oldTemplate, newTemplateText);

  await api.updateArticle(articleName, 'עדכון מפלס', newContent);
}
