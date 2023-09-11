import { parseLocalDate } from '../utilities';
import NewWikiApi from '../wiki/NewWikiApi';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import WikidataAPI from '../wiki/WikidataAPI';

const dateFormater = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export interface LevelData {
    date: Date;
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
  if (date1 > date2) {
    console.error('date1 must be before date2', {
      date1,
      date2,
    });
    throw new Error('date1 must be before date2');
  }
  // {{הפרש תאריכים|יום1|חודש1|שנה1|יום2|חודש2|שנה2}}
  return `{{הפרש תאריכים|${date1.getDate()}|${date1.getMonth() + 1}|${date1.getFullYear()}|${date2.getDate()}|${date2.getMonth() + 1}|${date2.getFullYear()}}}`;
}

const api = NewWikiApi();
const wikidataApi = WikidataAPI();

export async function updateLevel(
  levelData: LevelData,
  articleName: string,
  templateName:string = TEMPLATE_NAME,
  dateLevelField:string = DATE_LEVEL_FIELD,
  levelField:string = LEVEL_FIELD,
) {
  await api.login();
  const { date, level } = levelData;
  const localDate = formatDate(date);
  const content = await api.getArticleContent(articleName);
  if (!content) {
    throw new Error('Failed to get article content');
  }
  const template = findTemplate(content, templateName, articleName);
  const oldTemplate = template;
  const templateData = getTemplateKeyValueData(template);
  if (!oldTemplate) {
    throw new Error('Failed to get template text');
  }

  const change = Number(level) - Number(templateData[LEVEL_FIELD]);
  const changeData = getChangeData(change);
  const oldDate = templateData[DATE_LEVEL_FIELD];
  const parsedOldDate = parseLocalDate(oldDate);
  const today = new Date();

  if (today < date) {
    console.warn(`Date ${date} is in the future`);
    return;
  }

  if (templateData[dateLevelField] === localDate || parsedOldDate > date) {
    console.log(`No update needed for ${articleName}`);
    return;
  }

  const newTemplateText = templateFromKeyValueData({
    ...templateData,
    [dateLevelField]: localDate,
    [levelField]: level,
    [CAHNGE_FIELD]: `${changeData.text} ${changeData.icon} מלפני ${datesDiffereceInDays(parsedOldDate, date)}`,
  }, templateName, true);
  const newContent = content.replace(oldTemplate, newTemplateText);

  await api.updateArticle(articleName, 'עדכון מפלס', newContent);
}

export async function updateWikidata(
  levelData: LevelData,
) {
  await wikidataApi.login();
  console.log('level data', levelData);
  const claim = {
    type: 'statement',
    mainsnak: {
      snaktype: 'value', property: 'P2044', hash: 'e9b7ec76b372a857cc1095c0964062ddacb66855', datavalue: { type: 'quantity', value: { amount: levelData.level, unit: 'http://www.wikidata.org/entity/Q11573' } },
    },
    id: 'Q126982$DA559838-B44B-4A82-8BA4-01E8C0FB41D6',
    references: [{
      snaks: {
        P813: [{
          snaktype: 'value',
          property: 'P813',
          hash: 'a5f3dc67810646bcbcd345a8d21ce8fbdee3378d',
          datavalue: {
            type: 'time',
            value: {
              after: 0, before: 0, calendarmodel: 'http://www.wikidata.org/entity/Q1985727', precision: 11, time: `+${levelData.date.toJSON()}`, timezone: 0,
            },
          },
        }],
        P854: [{
          snaktype: 'value', property: 'P854', hash: 'd0bccfd0a597325f04f57dbb457f96c4fc6bc0c5', datavalue: { type: 'string', value: 'https://kineret.org.il/' },
        }],
      },
      'snaks-order': ['P813', 'P854'],
      hash: 'fb9f3198f9e45c0c5d85677575e67d03750a4bbf',
    }],
    rank: 'normal',
  };
  try {
    const res = await wikidataApi.setClaim(JSON.stringify(claim), 'update level');
    console.log('res', res);
  } catch (error) {
    console.log('error', error);
  }
}
