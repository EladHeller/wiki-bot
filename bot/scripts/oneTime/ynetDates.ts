import { WikiPage } from '../../types';
import {
  asyncGeneratorMapWithSequence, getFullYear, getLocalDate, parseLocalDate,
} from '../../utilities';
import NewWikiApi from '../../wiki/NewWikiApi';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';

const TEMPLATE_NAME = 'ynet';

export default async function ynetDates() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.categroyPages('שגיאות פרמטריות בתבנית Ynet');
  await asyncGeneratorMapWithSequence<WikiPage>(25, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('Missing content', page.title);
      return;
    }
    let newContent = content;
    const ynetTemplates = findTemplates(newContent, TEMPLATE_NAME, page.title);
    ynetTemplates.forEach((ynetTemplate) => {
      const arrayData = getTemplateArrayData(ynetTemplate, TEMPLATE_NAME, page.title, true);
      const date = arrayData[3];
      if (!date) {
        return;
      }
      const justDate = date.replace('{{כ}}', '')
        .replace('ניתן ב-', '')
        .replace('פורסם ב-', '')
        .replace('פורסם: ', '')
        .replace(/באתר \[?\[?YNET\]?\]?/i, '');
      const withLinkMatch = justDate.match(/^[הב]?\[?\[?(\d{1,2} ?ב[א-ת]{3,9})\]?\]?,? ?\[?\[?(\d{4})\]?\]?[.,]?$/);
      if (withLinkMatch) {
        const newTemplateText = ynetTemplate.replace(date, `${withLinkMatch[1]} ${withLinkMatch[2]}`);
        if (newTemplateText !== ynetTemplate) {
          console.log('WithLink', date);
          newContent = newContent.replace(ynetTemplate, newTemplateText);
        }
        return;
      }

      const shortYearMatch = justDate.match(/^(\d{1,2} ב[א-ת]{3,9}),? (\d{2})$/);
      if (shortYearMatch) {
        console.log('ShortYear', date);
        const newTemplateText = ynetTemplate.replace(date, `${shortYearMatch[1]} ${getFullYear(shortYearMatch[2])}`);
        newContent = newContent.replace(ynetTemplate, newTemplateText);
        return;
      }

      const parsedDate = parseLocalDate(justDate, false);
      if (!Number.isNaN(+parsedDate)) {
        return;
      }

      let dateFormatMatch = justDate.match(
        /^\s*(?<day>[0-3]?[0-9])[ \\/,.-](?<month>[01]?[0-9])[ \\/,.-](?<year>\d{2,4})[ /,.-]?(?:\s*,\s*\d{2}:\d{2})?\s*$/,
      );
      if (!dateFormatMatch) {
        dateFormatMatch = justDate.match(/^\s*(?<year>\d{4})[ /,.-](?<month>[01]?[0-9])[ /,.-](?<day>[0-3]?[0-9])\s*$/);
      }
      const { day, month, year } = dateFormatMatch?.groups ?? {};
      if (!dateFormatMatch || !day || !month || !year) {
        console.log('Invalid date', `* [[${page.title}]]: ${date}`);
        return;
      }
      const fullYear = getFullYear(year);
      const localDate = getLocalDate(`${fullYear}-${month}-${day}`);
      if (!localDate) {
        return;
      }
      const newTemplateText = ynetTemplate.replace(date, localDate);
      newContent = newContent.replace(ynetTemplate, newTemplateText);
    });
    if (newContent !== content) {
      await api.updateArticle(page.title, 'תבנית ynet: תיקון פורמט תאריך', newContent);
      console.log('Updated', page.title);
    }
  });
}
