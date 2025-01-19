import 'dotenv/config';

import NewWikiApi from '../wiki/NewWikiApi';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { getLocalDate } from '../utilities';
import getCasualties from './idfSiteScraper';
import getWarData from './inssSiteScraper';

const baseTemplatePageName = 'תבנית:אבדות במלחמת חרבות ברזל';
const templatePageName = `${baseTemplatePageName}/נתונים`;

const keysMapping = {
  חיילים: 'soldiersKilled',
  'חיילים בעזה': 'soldiersKilledManeuver',
  'חיילים פצועים': 'soldiersWounded',
  'חיילים פצועים בעזה': 'soldiersWoundedManeuver',
  'הרוגים ישראלים': 'הרוגים ישראלים',
  'סך החטופים ההרוגים': 'חטופים שנהרגו',
};

function replaceData(content: string, rows: string[], fieldName: string, newData?: number): string {
  const templateRow = rows.find((row) => row.startsWith(`|${fieldName}=`));
  if (!templateRow || !newData) {
    return content;
  }
  return content.replace(templateRow, `|${fieldName}=${newData}`);
}

function updateDate(content: string, rows: string[], fieldName: string): string {
  const templateRow = rows.find((row) => row.startsWith(`|מקור ${fieldName}=`));
  if (!templateRow) {
    return content;
  }
  const date = getLocalDate(new Date().toString());
  const oldDate = templateRow.match(/\d{1,2} ב[א-ת]{3,7} \d{4}/)?.[0];
  if (!oldDate) {
    throw new Error('Failed to update date');
  }
  const newRow = templateRow.replace(oldDate, date);
  return content.replace(templateRow, newRow);
}

export default async function ironSwordsBot() {
  const api = NewWikiApi();
  const casualties = await getCasualties();
  const warData = await getWarData();
  const allData = { ...casualties, ...warData };

  const { revid, content } = await api.articleContent(templatePageName);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const rows = content.split('\n').filter((row) => row.trim().startsWith('|'));
  let newContent = content;
  Object.entries(keysMapping).forEach(([key, value]) => {
    newContent = replaceData(newContent, rows, key, allData[value]);
  });
  if (newContent === content) {
    console.log('No changes');
    return;
  }
  Object.keys(keysMapping).forEach((key) => {
    newContent = updateDate(newContent, rows, key);
  });
  const editResult = await api.edit(templatePageName, 'בוט: עדכון נתוני אבדות', newContent, revid);
  console.log(editResult);
  await api.purge([baseTemplatePageName]);
}

export const main = shabathProtectorDecorator(ironSwordsBot);
