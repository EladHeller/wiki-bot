/* eslint-disable max-len */
import 'dotenv/config';
import NewWikiApi from '../../../wiki/NewWikiApi';
import linksToTemplates from '../../linksToTemplates';
import { WikiLink } from '../../../wiki/wikiLinkParser';
import { CiteNewsTemplate, GeneralLinkTemplateData } from '../../types';

const oldLink = 'www.nrg.co.il/online';

const pages: string[] = [];
const updatedPages: string[] = [];
const errorPages: string[] = [];

const linkRegex = /https?:\/\/www\.nrg\.co\.il\/online\/(\d{1,5}|archive)\/ART(\d{1,5})?\/(\d{1,5}(?:\/\d{1,5})?)\.html/i;

const notFountPage = 'https://www.makorrishon.co.il/nrg/images/stuff/404_page/404_page.html';

async function getSeries(match: RegExpMatchArray) {
  let url = `https://www.makorrishon.co.il/nrg/online/${match[1]}/ART${match[2] || ''}/${match[3]}.html`;

  let res = await fetch(url);
  if (res.url !== notFountPage) {
    return match[1];
  }
  // console.log('404', url);
  url = `https://www.makorrishon.co.il/nrg/online/1/ART${match[2] || ''}/${match[3]}.html`;
  res = await fetch(url);
  if (res.url !== notFountPage) {
    return '1';
  }
  console.log('404 after change', url);
  return null;
}

async function generalLinkConverter(generalLink: CiteNewsTemplate | GeneralLinkTemplateData) {
  const generalLinkData: GeneralLinkTemplateData = generalLink as GeneralLinkTemplateData;
  const citeNews: CiteNewsTemplate = generalLink as CiteNewsTemplate;

  const url = generalLinkData?.['כתובת'] || citeNews?.url || '';
  const match = url.match(linkRegex);
  if (!match) {
    console.log('Failed to get article id', url);
    return '';
  }
  const date = generalLinkData?.['תאריך'] ?? citeNews?.['access-date'] ?? '';
  const otherData = generalLink['מידע נוסף'] ?? '';
  const otherWords = (otherData || date) ? `${date}${(date && otherData) ? ', ' : ''}${otherData}` : '';

  const title = generalLinkData?.['כותרת'] || citeNews?.title || '';
  const authors = generalLinkData?.['הכותב'] || citeNews?.author || '';

  let series: string|null = match[1];
  if (series && !['1', 'archive'].includes(series)) {
    series = await getSeries(match);
  }

  if (!series) {
    return null;
  }
  return `{{nrg|${authors}|${title}|${match[3]}|${otherWords}|${series}|${match[2] || ''}}}`;
}

const writersRegex = /דביר בר|רונן טל|מוריה בן יוסף|שחר אורן|עודד מרום|עדי שבת|תמרה דקל|צח יוקד|מאיר שניצר|אלון הדר|כרמית ספיר ויץ|דניאל שחק|יעל פרידסון|נחום דידי|רוי רגב|שגיא כהן|רותי רוסו|יעל עופר|יובל גורן|אסף גבור|ניב גלבוע|יעקב זיו|גילי איזיקוביץ|תמר פרלשטיין|אסף רוזן|ערן סויסה|ברק רביד|אלישיב רייכנר|זאב קם|ארי גלהר|אבי זעירא|רון קסלר|אורי בינדר|סוכנויות הידיעות|עמית כהן|דליה מזורי|תומר ולמר|ירון ששון|לירן דנש|טל לאור|הרב יהודה ברנדס|אורי גליקמן|דורית גבאי|אסף גור|יונתן לוי|אורי גלזר|אורי יבלונקה|חן קוטסבר|יוחאי עופר|פליקס פריש|יניב טוכמן|אליענה שפר|ליאת רון|רוביק רוזנטל|אלי לוי|רן יגיל|חזי כרמל|אלעד דויטש|יהודה שרוני|מנחם בן|איתמר ענברי|טל שנידר|טל שניידר|ענבל שתיוי|ארז בן[- ]ארי|אמיר בוחבוט|מרב בטיטו(?:[- ])?(?:פריד)?|יאיר קלדור|אריק בנדר|יוסי מזרחי|רון מיברג|רון לוין|אריאל כהנא|נתן זהבי|שלום ירושלמי|עופר שלח|עפר שלח|אראל סג"ל|רועי שרון|אלכס דורון/g;
const dateRegex = /\d{1,2}(?:[.-/])\d{1,2}(?:[.-/])(?:\[\[)?\d{2,4}(?:\]\])?/;
const otherDateRegex = /(?:(?:\[\[)?\d{1,2}[\s,-]{1,3})?[א-ת]{3,8}(?:\]\])?[\s,-]{1,3}(?:\[\[)?\d{4}(?:\]\])?/;

async function externalLinkConverter(originalText: string, { link, text }: WikiLink) {
  const match = link.match(linkRegex);
  if (!match) {
    return null;
  }
  const writersMatch = Array.from(originalText.matchAll(writersRegex));
  const writers = writersMatch.map((writerMatch) => writerMatch[0]);
  const date = originalText.match(dateRegex)?.[0] || originalText.match(otherDateRegex)?.[0] || '';
  let remainText = originalText;
  writers.forEach((writer) => {
    remainText = remainText.replaceAll(writer, '');
  });

  const lastWriter = writers.pop();
  let writerText = '';
  if (!writers.length) {
    writerText = lastWriter || '';
  } else {
    writerText = `${writers.join(', ')} ו${lastWriter}`;
  }

  remainText = remainText
    .replace(link, '')
    .replace(text, '')
    .replace(date, '')
    .replace('{{כותרת קישור נוצרה על ידי בוט}}', '')
    .replace(/(?:\[\[)?nrg(?:\]\])?/gi, '')
    .replace(/(?:\[\[)?מעריב(?:\]\])?/g, '')
    .replace(/[מב]?אתר/g, '')
    .replace(/ב-/g, '')
    .replace(/זמן תל אביב/g, '')
    .replace(/ ב /g, '')
    .replace(/מתוך/g, '')
    .replace(/ראיון/g, '')
    .replace(/חדשות/g, '')
    .replace(/ניו אייג'/g, '')
    .replace(/בתאריך/g, '')
    .replace(/כתבה/g, '')
    .replace(/מאת/g, '')
    .replace(/כתבת/g, '')
    .replace(/ארכיון/g, '')
    .replace(/עיתונאי/g, '')
    .replace(/שליפות/g, '')
    .replace(/יהדות/g, '')
    .replace(/{{כ}}/g, '')
    .replace(/{{סרטונים}}/g, '')
    .replace(/\d{1,2}[\s,-]{1,3}[א-ת]{4,8}[\s,-]{1,3}\d{4}/g, '')
    .replace(/\s+/g, '')
    .replace(/\d{1,2}(?:[.-/])\d{1,2}(?:[.-/])\d{2,4}/g, '')
    .replace(/[[\],*()|:.'"–ו-]/g, '');
  if (remainText) {
    return null;
  }
  let series: string|null = match[1];
  if (!['1', 'archive'].includes(series)) {
    series = await getSeries(match);
  }

  if (!series) {
    return null;
  }

  return `{{nrg|${writerText}|${text}|${match[3]}|${date}|${series}|${match[2] || ''}}}`;
}

export default async function nrgTemplate() {
  const api = NewWikiApi();
  await api.login();
  await linksToTemplates({
    url: oldLink,
    description: 'המרת קישור לתבנית nrg',
    externalLinkConverter,
    generalLinkConverter,
  });

  console.log('Pages:', pages.length);
  console.log('Updated:', updatedPages.length);
  console.log('Errors:', errorPages.length);
  console.log('Error pages:', errorPages.toString());
}
