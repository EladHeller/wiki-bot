/* eslint-disable max-len */
import 'dotenv/config';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import NewWikiApi from '../../../wiki/NewWikiApi';
import linksToTemplates, { basicConverter, PageData } from '../../linksToTemplates';
import { WikiLink } from '../../../wiki/wikiLinkParser';
import { CiteNewsTemplate, GeneralLinkTemplateData } from '../../types';
import { getContent } from '../../../scraping';
import { getFullYear, getLocalDate } from '../../../utilities';

const oldLink = 'www.nrg.co.il/online';

const linkRegex = /https?:\/\/www\.nrg\.co\.il\/online\/(?<series>\d{1,5}|archive)\/ART(?<artNumber>\d{1,5})?\/(?<id>\d{1,5}(?:\/\d{1,5})?)\.html/i;

const notFountPage = 'https://www.makorrishon.co.il/nrg/images/stuff/404_page/404_page.html';

/*
https://www.makorrishon.co.il/nrg/online/1/ART/789/163.html
https://www.makorrishon.co.il/nrg/online/1/ART1/451/288.html
https://www.makorrishon.co.il/nrg/online/15/ART1/072/964.html
https://www.makorrishon.co.il/nrg/online/archive/ART94/521.html
https://www.makorrishon.co.il/nrg/online/54/ART2/060/324.html
https://www.makorrishon.co.il/nrg/online/15/ART1/072/964.html
https://www.makorrishon.co.il/nrg/online/71/ART2/350/295.html
https://www.makorrishon.co.il/nrg/online/archive/ART/474/584.html
https://www.makorrishon.co.il/nrg/online/20/ART2/387/424.html
*/
async function getDataFromPage(link: string, articleTitle: string): Promise<PageData & {series: string}| null> {
  const match = link.match(linkRegex);
  const { id, series, artNumber } = match?.groups ?? {};
  let newSeries = series;
  if (!id || !series) {
    console.log('Failed to get article id or series', link, articleTitle, { id, series, artNumber });
    return null;
  }
  const url = `https://www.makorrishon.co.il/nrg/online/${series ?? '1'}/ART${artNumber ?? ''}/${id}.html`;
  try {
    let date: string | undefined;
    let author: string | undefined;
    let dom = await JSDOM.fromURL(url);
    if (dom.window.location.href === notFountPage) {
      dom = await JSDOM.fromURL(`https://www.makorrishon.co.il/nrg/online/1/ART${artNumber ?? ''}/${id}.html`);
      newSeries = '1';
    }
    if (dom.window.location.href === notFountPage) {
      dom = await JSDOM.fromURL(`https://www.makorrishon.co.il/nrg/online/archive/ART${artNumber ?? ''}/${id}.html`);
      newSeries = 'archive';
    }
    if (dom.window.location.href === notFountPage) {
      console.log('404', url, articleTitle);
      return null;
    }

    // date
    const dateText = getContent(dom.window.document, '#articleCBar > .cdat, .article-autor > .cdat, #article-autor > .cdat, .newsVitzCredit, #art_date, .opinionMainVitzBody, .articleBar > h4, #articleBody > .spacer') ?? '';
    const dateMatch = dateText.match(/(?<day>\d{1,2})[/.](?<month>\d{1,2})[/.](?<year>\d{2,4})/);
    const { year, month, day } = dateMatch?.groups ?? {};
    if (year && month && day) {
      date = getLocalDate(`${getFullYear(year)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    } else {
      console.log('Failed to get date from page', url, articleTitle);
    }

    // author
    author = getContent(dom.window.document, '#art_credit')?.trim() ?? '';
    if (!author) {
      author = dateText;
      const hourMatch = dateText.match(/(\d{1,2}:\d{1,2})/);

      if (hourMatch) {
        author = author.replace(hourMatch[0], '');
      }
      if (dateMatch) {
        author = author.replace(dateMatch[0], '');
      }

      author = author.replace(/[,|:]/g, '').replace('מאת', '').replace('changeClass();', '').trim();
    }
    // title
    const title = getContent(dom.window.document, '#titleS1, #article > h1, #top_story_title, #articleBody > h1')?.trim() ?? undefined;

    return {
      date,
      author,
      title,
      series: newSeries,
    };
  } catch (e) {
    console.log('Failed to get data from page', url, articleTitle, e);
    return null;
  }
}

async function getSeries(match: RegExpMatchArray) {
  const originalUrl = `https://www.makorrishon.co.il/nrg/online/${match[1]}/ART${match[2] || ''}/${match[3]}.html`;

  let res = await fetch(originalUrl);
  if (res.url !== notFountPage) {
    return match[1];
  }
  // console.log('404', url);
  const modifiedUrl = `https://www.makorrishon.co.il/nrg/online/1/ART${match[2] || ''}/${match[3]}.html`;
  res = await fetch(modifiedUrl);
  if (res.url !== notFountPage) {
    return '1';
  }
  console.log('404 after change', { modifiedUrl, originalUrl });
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

// const authorsRegex = /דנה ויילר|ענת שיחור-אהרונסון|מקור ראשון|בן זגגי|רגב גולדמן|קלמן ליבסקינד|אור גלזר|אהוד פירר|רגב גולדמן|בן דרור ימיני|אחיקם משה דוד|ערן סורוקה|יהונתן גפן|חני יודל|עמרי מניב|רותי קדוש|עמרי גלפרין|אלמוג שריד|דביר בר|רונן טל|מוריה בן יוסף|שחר אורן|עודד מרום|עדי שבת|תמרה דקל|צח יוקד|מאיר שניצר|אלון הדר|כרמית ספיר ויץ|דניאל שחק|יעל פרידסון|נחום דידי|רוי רגב|שגיא כהן|רותי רוסו|יעל עופר|יובל גורן|אסף גבור|ניב גלבוע|יעקב זיו|גילי איזיקוביץ|תמר פרלשטיין|אסף רוזן|ערן סויסה|ברק רביד|אלישיב רייכנר|זאב קם|ארי גלהר|אבי זעירא|רון קסלר|אורי בינדר|סוכנויות הידיעות|עמית כהן|דליה מזורי|תומר ולמר|ירון ששון|לירן דנש|טל לאור|הרב יהודה ברנדס|אורי גליקמן|דורית גבאי|אסף גור|יונתן לוי|אורי גלזר|אורי יבלונקה|חן קוטסבר|יוחאי עופר|פליקס פריש|יניב טוכמן|אליענה שפר|ליאת רון|רוביק רוזנטל|אלי לוי|רן יגיל|חזי כרמל|אלעד דויטש|יהודה שרוני|מנחם בן|איתמר ענברי|טל שנידר|טל שניידר|ענבל שתיוי|ארז בן[- ]ארי|אמיר בוחבוט|מרב בטיטו(?:[- ])?(?:פריד)?|יאיר קלדור|אריק בנדר|יוסי מזרחי|רון מיברג|רון לוין|אריאל כהנא|נתן זהבי|שלום ירושלמי|עופר שלח|עפר שלח|אראל סג"ל|רועי שרון|אלכס דורון/g;
const remains: string[][] = [];

async function externalLinkConverter(originalText: string, { link, text }: WikiLink, wikiPageTitle: string) {
  const pageData = await getDataFromPage(link, originalText);
  const converterData = basicConverter(originalText, { link, text }, linkRegex, pageData, wikiPageTitle);
  if (!converterData) {
    return null;
  }
  const {
    remainText, authorText, date, match,
  } = converterData;
  if (remainText) {
    remains.push([remainText, originalText]);
    return null;
  }
  let series: string|null = match[1];
  if (!['1', 'archive'].includes(series)) {
    series = pageData?.series ?? null;
  }

  if (!series) {
    return null;
  }

  return `{{nrg|${authorText}|${text}|${match[3]}|${date}|${series}|${match[2] || ''}}}`;
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

  await fs.writeFile('remains.log', remains.join('\n'));
}
