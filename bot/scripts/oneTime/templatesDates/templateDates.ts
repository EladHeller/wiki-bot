import { WikiPage } from '../../../types';
import {
  asyncGeneratorMapWithSequence, getFullYear, getLocalDate, parseLocalDate, promiseSequence,
} from '../../../utilities';
import NewWikiApi from '../../../wiki/NewWikiApi';
import { findTemplates, getTemplateArrayData } from '../../../wiki/newTemplateParser';

const hebrewDateRegex = /\s*(?:[א-ת]['׳] |[א-ת]["״][א-ת] )?[א-ת]{3,10}(?: [אב]['׳])? (?:ה['׳]?)?[א-ת]{2,3}(?:["״][א-ת])? ?[.,/]?\s*/;
const exactHebrewDateRegex = /^\s*(?:[א-ת]['׳] |[א-ת]["״][א-ת] )?[א-ת]{3,10}(?: [אב]['׳])? (?:ה['׳]?)?[א-ת]{2,3}(?:["״][א-ת])? ?[.,/]?\s*$/;

type DateFromPageCallback = (id: string, title: string, section?: string) => Promise<string>;
type TemplateData = {
    id: string;
    date: string;
    section?: string;
}

function defaultGetTemplateData(data: string[]): TemplateData {
  const [,, id, date, section] = data;
  return {
    id,
    date,
    section,
  };
}

export default async function templateDates(
  templateName: string,
  getDataFromPage: DateFromPageCallback,
  uniqueFilters: RegExp[] = [],
  templateNameVersion = templateName,
  getTemplateData: (data: string[]) => TemplateData = defaultGetTemplateData,
) {
  const api = NewWikiApi();
  await api.login();
  const generator = api.categroyPages(`שגיאות פרמטריות בתבנית ${templateName}`);
  await asyncGeneratorMapWithSequence<WikiPage>(1, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('Missing content', page.title);
      return;
    }
    let newContent = content;
    const templates = findTemplates(newContent, templateNameVersion, page.title);
    if (templates.length === 0) {
      console.log('No templates', page.title);
      return;
    }
    await promiseSequence(1, templates.map((template) => async () => {
      const arrayData = getTemplateArrayData(template, templateNameVersion, page.title, true);
      const { id, date, section } = getTemplateData(arrayData);
      if (!date) {
        return;
      }

      const justDate = uniqueFilters.reduce((acc, filter) => acc.replace(filter, ''), date)
        .replace('{{כ}}', '')
        .replace('ניתן ב-', '')
        .replace(/פורסם ב-?/, '')
        .replace(/[מב]תאריך/, '')
        .replace(/בשנת/, '')
        .replace('פורסם: ', '')
        .replace(hebrewDateRegex, '')
        .replace(/באתר/i, '')
        .trim();

      if (date.trim().match(exactHebrewDateRegex)
          || justDate.match(/^([א-ת]{3,10},? )?\d{4}[.,]?$/) // במאי 2014
          || justDate.match(/^\d{1,2} ב?[א-ת]{3,9}[.,]?$/) // 1 במאי
          || justDate.match(/^ב?\[?\[?[א-ת]{3,9}\]?\]?[,.]? \[?\[?\d{4}\]?\]?[,.]?$/) // ב[[מאי]] [[2014]]
          || !justDate) {
        const dateFromDoc = await getDataFromPage(id, page.title, section);
        if (dateFromDoc) {
          const newTemplateText = template.replace(date, dateFromDoc);
          newContent = newContent.replace(template, newTemplateText);
          console.log('DateFromDoc', date, dateFromDoc, page.title);
          return;
        }
      }

      const formatWithAdditions = justDate.match(/^[הב]?\[?\[?(\d{1,2})[בן,]?\s?ב?\[?\[?([א-ת]{3,9})\]?\]?,?\s?(?:''')?\[?\[?(\d{4})\]?\]?(?:''')?[.,]?$/);
      if (formatWithAdditions) {
        const newTemplateText = template.replace(date, `${formatWithAdditions[1]} ב${formatWithAdditions[2]} ${formatWithAdditions[3]}`);
        if (newTemplateText !== template) {
          console.log('WithLink', date);
          newContent = newContent.replace(template, newTemplateText);
        }
        return;
      }

      const reverseDate = justDate.match(/^\s*([א-ת]{3,9}) (\d{1,2}),? ?(\d{4})/);
      if (reverseDate) {
        const newTemplateText = template.replace(date, `${reverseDate[2]} ב${reverseDate[1]} ${reverseDate[3]}`);
        if (newTemplateText !== template) {
          console.log('reverse date', date);
          newContent = newContent.replace(template, newTemplateText);
        }
        return;
      }

      const shortYearMatch = justDate.match(/^(\d{1,2} ב[א-ת]{3,9}),? (\d{2})$/);
      if (shortYearMatch) {
        console.log('ShortYear', date);
        const newTemplateText = template.replace(date, `${shortYearMatch[1]} ${getFullYear(shortYearMatch[2])}`);
        newContent = newContent.replace(template, newTemplateText);
        return;
      }

      const parsedDate = parseLocalDate(justDate, false);
      if (!Number.isNaN(+parsedDate)) {
        console.log('ParsedDate passed', date, page.title);
        return;
      }

      let dateFormatMatch = justDate.match(
        /^\s*\(?(?:\d{2}:\d{2}\s*,\s*)?(?<day>[0-3]?[0-9])[ \\/,.-](?<month>[01]?[0-9])[ \\/,.-](?<year>\d{2,4})[ /,.-]?(?:\s*,?\s*\d{2}:\d{2})?\)?\s*$/, // 01/02/03
      );
      if (!dateFormatMatch) {
        dateFormatMatch = justDate.match(/^\s*(?<year>\d{4})[ /,.-](?<month>[01]?[0-9])[ /,.-](?<day>[0-3]?[0-9])\s*$/); // 2003/01/02
      }
      const { day, month, year } = dateFormatMatch?.groups ?? {};
      if (!dateFormatMatch || !day || !month || !year) {
        console.log('Invalid date', `* [[${page.title}]]: ${date}`);
        return;
      }
      const fullYear = getFullYear(year);
      const localDate = getLocalDate(`${fullYear}-${month}-${day}`);
      if (!localDate) {
        console.log('Invalid local date', `* [[${page.title}]]: ${date}`);
        return;
      }
      const newTemplateText = template.replace(date, localDate);
      newContent = newContent.replace(template, newTemplateText);
    }));
    if (newContent !== content) {
      await api.updateArticle(page.title, `תבנית ${templateName}: תיקון פורמט תאריך`, newContent);
      console.log('Updated', page.title);
    }
  });
}
