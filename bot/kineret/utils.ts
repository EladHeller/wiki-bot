import { getArticleContent, updateArticle } from '../wikiAPI';
import WikiTemplateParser from '../WikiTemplateParser';

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
  if (change > 0) {
    return {
      text: 'עלייה',
      icon: '[[File:Increase2.svg|11px]]',
    };
  }
  return {
    text: 'ירידה',
    icon: '[[File:Decrease2.svg|11px]]',
  };
}

export async function updateLevel(
  levelData: LevelData,
  articleName: string,
  templateName:string = TEMPLATE_NAME,
  dateLevelField:string = DATE_LEVEL_FIELD,
  levelField:string = LEVEL_FIELD,
) {
  const { date, level } = levelData;

  const content = await getArticleContent(articleName);
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

  const newTemplateText = template.updateTamplateFromData({
    ...template.templateData,
    [dateLevelField]: date,
    [levelField]: level,
    [CAHNGE_FIELD]: `${changeData.text} של ${Math.abs(change * 100)} ס"מ ${changeData.icon} מ-${oldDate}`,
  });
  const newContent = content.replace(oldTemplate, newTemplateText);

  await updateArticle(articleName, 'עדכון מפלס', newContent);
}
