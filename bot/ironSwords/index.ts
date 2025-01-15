import 'dotenv/config';
import * as playwright from 'playwright-aws-lambda';
import { JSDOM } from 'jsdom';
import { Browser } from 'playwright-core';
import NewWikiApi from '../wiki/NewWikiApi';
import shabathProtectorDecorator from '../decorators/shabathProtector';
import { getLocalDate } from '../utilities';

const baseTemplatePageName = 'תבנית:אבדות במלחמת חרבות ברזל';
const templatePageName = `${baseTemplatePageName}/נתונים`;
const url = 'https://www.idf.il/אתרי-יחידות/יומן-המלחמה/חללי-ופצועי-צה-ל-במלחמה/';

function getCounter(
  counters: Element[],
  title: string,
  index?: number,
): number | null {
  const elements = counters.filter((counter) => {
    const text = counter.textContent;
    return text?.includes(title);
  });
  if (elements.length > 1 && index == null) {
    throw new Error(`Multiple counters with title ${title}`);
  }
  const element = elements[index ?? 0];
  const numberElement = element?.querySelector('.counters');
  const text = numberElement?.textContent;
  if (!text) {
    throw new Error(`Counter with title ${title} not found`);
  }
  return text ? Number(text.trim().replaceAll(',', '')) : null;
}

async function getCasualties() {
  let browser: Browser | null = null;
  try {
    browser = await playwright.launchChromium({
      headless: false,
      timeout: 10 * 1000,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    const content = await page.content();
    const { window } = new JSDOM(content);
    const counters = Array.from(window.document.querySelectorAll('.counter-parent'));
    const soldiersKilled = getCounter(counters, 'חללים מתחילת המלחמה');
    const soldiersKilledManeuver = getCounter(counters, 'חללים מהתמרון בעזה');
    const soldiersWounded = getCounter(counters, 'סה"כ', 0);
    const soldiersWoundedManeuver = getCounter(counters, 'סה"כ', 1);
    return {
      soldiersKilled,
      soldiersKilledManeuver,
      soldiersWounded,
      soldiersWoundedManeuver,
    };
  } finally {
    await browser?.close();
  }
}

const keysMapping = {
  חיילים: 'soldiersKilled',
  'חיילים בעזה': 'soldiersKilledManeuver',
  'חיילים פצועים': 'soldiersWounded',
  'חיילים פצועים בעזה': 'soldiersWoundedManeuver',
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

  const { revid, content } = await api.articleContent(templatePageName);
  if (!content) {
    throw new Error('Failed to get template content');
  }
  const rows = content.split('\n').filter((row) => row.trim().startsWith('|'));
  let newContent = content;
  Object.entries(keysMapping).forEach(([key, value]) => {
    newContent = replaceData(newContent, rows, key, casualties[value]);
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
