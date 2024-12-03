/* eslint-disable max-len */
import { WikiPage } from '../../../types';
import {
  asyncGeneratorMapWithSequence, promiseSequence,
} from '../../../utilities';
import formalizedDateFormat from '../../../utilities/formalizedDateFormat';
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
      let newDate: string | null = '';
      if (date.trim().match(exactHebrewDateRegex)
          || justDate.match(/^([א-ת]{3,10},? )?\d{4}[.,]?$/) // במאי 2014
          || justDate.match(/^\d{1,2} ב?[א-ת]{3,9}[.,]?$/) // 1 במאי
          || justDate.match(/^ב?\[?\[?[א-ת]{3,9}\]?\]?[,.]? \[?\[?\d{4}\]?\]?[,.]?$/) // ב[[מאי]] [[2014]]
          || !justDate) {
        newDate = await getDataFromPage(id, page.title, section);
        if (newDate) {
          console.log('DateFromDoc', date, newDate, page.title);
          return;
        }
      }
      if (!newDate) {
        newDate = formalizedDateFormat(justDate, page.title);
      }
      if (newDate) {
        const newTemplateText = template.replace(date, newDate);
        newContent = newContent.replace(template, newTemplateText);
      }
    }));
    if (newContent !== content) {
      await api.updateArticle(page.title, `תבנית ${templateName}: תיקון פורמט תאריך`, newContent);
      console.log('Updated', page.title);
    }
  });
}
