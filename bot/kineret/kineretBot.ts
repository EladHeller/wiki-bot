import 'dotenv/config';
import { JSDOM } from 'jsdom';
import { getArticleContent, login, updateArticle } from '../wikiAPI';
import WikiTemplateParser from '../WikiTemplateParser';

const dateFormater = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{2})/;

const dateSource = '{{הערה|[http://kineret.org.il רשות ניקוז ונחלים כנרת]}}';

const dateLevelField = 'תאריך גובה';
const levelField = 'גובה';
const articleName = 'הכנרת';

async function getKineretLevel() {
  const kinneretDocument = await JSDOM.fromURL('https://kineret.org.il/');
  const levelElement = kinneretDocument.window.document.querySelector('#hp_miflas');
  const date = levelElement?.querySelector('.hp_miflas_date')?.textContent?.match(DATE_REGEX);
  const level = levelElement?.querySelector('.hp_miflas_height')?.textContent;
  if (!date || !level) {
    throw new Error('Failed to get kinneret level');
  }
  const [, day, month, year] = date;
  const dateFormat = dateFormater.format(new Date(`20${year}-${month}-${day}`));
  return {
    date: dateFormat,
    level,
  };
}

export async function main() {
  await login();

  const { date, level } = await getKineretLevel();

  const content = await getArticleContent(articleName);
  if (!content) {
    throw new Error('Failed to get article content');
  }
  const template = new WikiTemplateParser(content, 'גוף מים');
  const oldTemplate = template.templateText;
  if (!oldTemplate) {
    throw new Error('Failed to get template text');
  }

  const newDate = `${date}${dateSource}`;
  if (template.templateData[dateLevelField] === newDate) {
    console.log('No update needed');
  }

  const newTemplateText = template.updateTamplateFromData({
    ...template.templateData,
    [dateLevelField]: newDate,
    [levelField]: level,
  });
  const newContent = content.replace(oldTemplate, newTemplateText);

  await updateArticle(articleName, 'עדכון מפלס', newContent);
}

export default {
  main,
};
