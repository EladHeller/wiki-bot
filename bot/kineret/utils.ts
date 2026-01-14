import { IWikiApi } from '../wiki/WikiApi';
import { IWikiDataAPI } from '../wiki/WikidataAPI';
import { WikiDataClaim } from '../types';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import { parseLocalDate } from '../utilities';

export const METER_UNIT = 'http://www.wikidata.org/entity/Q11573';
export const ELEVATION_ABOVE_SEA_LEVEL_ID = 'P2044';

export const TEMPLATE_NAME = 'גוף מים';
export const DATE_LEVEL_FIELD = 'תאריך גובה';
export const LEVEL_FIELD = 'גובה';
export const CHANGE_FIELD = 'שינוי';

export interface LevelData {
  date: Date;
  level: string;
}

export function getChangeData(change: number) {
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

export function datesDifferenceInDays(date1: Date, date2: Date) {
  if (date1 > date2) {
    throw new Error('date1 must be before date2');
  }
  return `{{הפרש תאריכים|${date1.getDate()}|${date1.getMonth() + 1}|${date1.getFullYear()}|${date2.getDate()}|${date2.getMonth() + 1}|${date2.getFullYear()}}}`;
}

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function formatDate(date: Date) {
  return dateFormatter.format(date);
}

export function formatWikiDataDate(date: Date) {
  const now = new Date(date);
  now.setHours(0);
  now.setMinutes(0 - now.getTimezoneOffset());
  now.setSeconds(0);
  return `+${now.toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
}

export async function getContent(wikiApi: IWikiApi, title: string) {
  const result = await wikiApi.articleContent(title);
  if (!result || !result.content) {
    throw new Error(`Missing content for ${title}`);
  }
  if (!result.revid) {
    throw new Error(`Missing revid for ${title}`);
  }
  return result;
}

interface TimeReferenceValue {
  time: string;
}

export function getValidTimeReference(currentClaim: WikiDataClaim, referenceUrl: string): TimeReferenceValue | null {
  const isUnitValid = currentClaim.mainsnak.datavalue.value.unit === METER_UNIT;
  const isReferenceValid = currentClaim.references?.length === 1
    && currentClaim.references?.[0].snaks?.P854?.[0]?.datavalue?.value === referenceUrl;
  const timeRefValue = currentClaim.references?.[0].snaks?.P813?.[0]?.datavalue?.value;
  if (!isUnitValid || !isReferenceValid || !timeRefValue?.time) {
    return null;
  }
  return timeRefValue;
}

export async function updateTemplate(
  wikiApi: IWikiApi,
  levelData: LevelData,
  templatePage: string,
  getCurrentDate: () => Date,
): Promise<boolean> {
  const { date, level } = levelData;
  const formattedDate = formatDate(date);
  const articleName = `${templatePage}/נתונים`;

  const { content, revid } = await getContent(wikiApi, articleName);
  const template = findTemplate(content, TEMPLATE_NAME, articleName);
  if (!template) {
    throw new Error('Template not found');
  }

  const templateData = getTemplateKeyValueData(template);
  const oldDate = templateData[DATE_LEVEL_FIELD];
  const parsedOldDate = parseLocalDate(oldDate);
  const parsedDate = parseLocalDate(formattedDate);
  const today = getCurrentDate();

  if (today < parsedDate || templateData[DATE_LEVEL_FIELD] === formattedDate || parsedOldDate > parsedDate) {
    return false;
  }

  const change = Number(level) - Number(templateData[LEVEL_FIELD]);
  const changeData = getChangeData(change);

  const newTemplateText = templateFromKeyValueData({
    ...templateData,
    [DATE_LEVEL_FIELD]: formattedDate,
    [LEVEL_FIELD]: level,
    [CHANGE_FIELD]: `${changeData.text} ${changeData.icon} מלפני ${datesDifferenceInDays(parsedOldDate, parsedDate)}`,
  }, TEMPLATE_NAME, true);

  const newContent = content.replace(template, newTemplateText);
  await wikiApi.edit(articleName, 'עדכון מפלס', newContent, revid);
  await wikiApi.purge([templatePage]);
  return true;
}

export async function updateElevationClaim(
  wikiDataApi: IWikiDataAPI,
  itemId: string,
  date: Date,
  level: number,
  referenceUrl: string,
  summary: string,
): Promise<boolean> {
  const claims = await wikiDataApi.getClaim(itemId, ELEVATION_ABOVE_SEA_LEVEL_ID);
  if (claims.length !== 1) {
    throw new Error(`${itemId} elevation claim is not valid`);
  }

  const currentClaim = claims[0];
  const timeRefValue = getValidTimeReference(currentClaim, referenceUrl);
  if (!timeRefValue) {
    throw new Error(`${itemId} elevation claim is not valid`);
  }

  const currentLevel = Number(currentClaim.mainsnak.datavalue.value.amount);
  if (Math.abs(currentLevel - level) < 0.02) {
    return false;
  }

  const revId = await wikiDataApi.getRevId(itemId);
  currentClaim.mainsnak.datavalue.value.amount = level.toString();
  timeRefValue.time = formatWikiDataDate(date);

  const updateRes = await wikiDataApi.setClaim(currentClaim, summary, revId);
  if (updateRes.success !== 1) {
    throw new Error(`Failed to update ${itemId} in Wikidata`);
  }
  return true;
}
