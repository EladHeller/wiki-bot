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
const TEMPLATE_NAME = 'גוף מים';

export async function updateLevel(levelData: LevelData, articleName: string, dataSource: string) {
  const { date, level } = levelData;

  const content = await getArticleContent(articleName);
  if (!content) {
    throw new Error('Failed to get article content');
  }
  const template = new WikiTemplateParser(content, TEMPLATE_NAME);
  const oldTemplate = template.templateText;
  if (!oldTemplate) {
    throw new Error('Failed to get template text');
  }

  const newDate = `${date}${dataSource}`;
  if (template.templateData[DATE_LEVEL_FIELD] === newDate) {
    console.log('No update needed');
  }

  const newTemplateText = template.updateTamplateFromData({
    ...template.templateData,
    [DATE_LEVEL_FIELD]: newDate,
    [LEVEL_FIELD]: level,
  });
  const newContent = content.replace(oldTemplate, newTemplateText);

  await updateArticle(articleName, 'עדכון מפלס', newContent);
}
