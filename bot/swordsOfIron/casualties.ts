import { JSDOM } from 'jsdom';
import NewWikiApi from '../wiki/NewWikiApi';
import shabathProtectorDecorator from '../decorators/shabathProtector';

const templateName = 'תבנית:אבדות במלחמת חרבות ברזל/נתונים';
const url = 'https://www.idf.il/אתרי-יחידות/יומן-המלחמה/נתונים-אבידות-מספרים-כמה-חללים-מתים-פצועים-קל-בינוני-קשה-מאושפזים-תחילת-המלחמה-תחילת-התמרון-מלחמה-עזה-מתעדכן/';

async function getCasualties() {
  const html = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9,de;q=0.8,he;q=0.7,uk;q=0.6',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      Host: 'www.idf.il',
      Pragma: 'no-cache',
      Referer: 'https://duckduckgo.com/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-gpc': '1',
    },
  }).then((response) => response.text());
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const rootElement = document.querySelector('.row.clearfix > .column > div');
  if (!rootElement) {
    return null;
  }

  const [deaths, , injured, injuredInGaza] = Array.from(rootElement.querySelectorAll('.counter'));
  const [deathsAll, deathsInsideGaza] = Array.from(deaths.querySelectorAll('.counters'));
  const [,,, injuredAll] = Array.from(injured.querySelectorAll('.counters'));
  const [,,, injuredInGazaAll] = Array.from(injuredInGaza.querySelectorAll('.counters'));

  if (!deathsAll || !deathsInsideGaza || !injuredAll || !injuredInGazaAll) {
    console.log(html);
    return null;
  }

  return {
    deathsAll: deathsAll?.textContent?.trim(),
    deathsInsideGaza: deathsInsideGaza?.textContent?.trim(),
    injuredAll: injuredAll?.textContent?.trim(),
    injuredInGazaAll: injuredInGazaAll?.textContent?.trim(),
  };
}

function replaceData(content: string, rows: string[], fieldName: string, newData?: string): string {
  const templateRow = rows.find((row) => row.startsWith(`|${fieldName}=`));
  if (!templateRow || !newData) {
    return content;
  }
  return content.replace(templateRow, `|${fieldName}=${newData.replace(/,/g, '')}`);
}

export default async function casualtiesBot() {
  const api = NewWikiApi();
  let casualties = await getCasualties();
  if (!casualties) {
    console.log('Failed to get casualties, trying again');
    casualties = await getCasualties();
    if (!casualties) {
      throw new Error('Failed to get casualties');
    }
  }

  const contentResult = await api.articleContent(templateName);
  if (!contentResult) {
    throw new Error('Failed to get article content');
  }
  const { content, revid } = contentResult;
  const rows = content.split('\n').filter((row) => row.trim().startsWith('|'));
  let newContent = replaceData(content, rows, 'חיילים', casualties.deathsAll);
  newContent = replaceData(newContent, rows, 'חיילים בעזה', casualties.deathsInsideGaza);
  newContent = replaceData(newContent, rows, 'חיילים פצועים', casualties.injuredAll);
  newContent = replaceData(newContent, rows, 'ו"חיילים פצועים בעזה', casualties.injuredInGazaAll);
  if (newContent === content) {
    console.log('No changes');
    return;
  }
  await api.edit(templateName, newContent, 'בוט: עדכון נתוני אבדות', revid);
}

export const main = shabathProtectorDecorator(casualtiesBot);
