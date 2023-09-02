import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, getLocalDate, parseLocalDate } from '../../utilities';
import NewWikiApi from '../../wiki/NewWikiApi';
import { findTemplates, getTemplateArrayData } from '../../wiki/newTemplateParser';

const TEMPLATE_NAME = 'הארץ';

export default async function haaretzDates() {
  const api = NewWikiApi();
  await api.login();
  const generator = api.categroyPages('שגיאות פרמטריות בתבנית הארץ');
  await asyncGeneratorMapWithSequence<WikiPage>(25, generator, (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('Missing content', page.title);
      return;
    }
    let newContent = content;
    const haaretzTemplates = findTemplates(newContent, TEMPLATE_NAME, page.title);
    haaretzTemplates.forEach((haaretzTemplate) => {
      const arrayData = getTemplateArrayData(haaretzTemplate, TEMPLATE_NAME, page.title, true);
      const date = arrayData[3];
      if (!date) {
        return;
      }
      let justDate = date.replace('{{כ}}', '').replace('פורסם ב-', '');
      const justDateMatch = justDate.match(/^(\d{1,2} [א-ת]{4,10}) (\d{1,2})$/);
      if (justDateMatch) {
        console.log('ShortDate', date, page.title);
        justDate = `${justDateMatch[1]} 20${justDateMatch[2]}`;
        const newTemplateText = haaretzTemplate.replace(date, justDate);
        newContent = newContent.replace(haaretzTemplate, newTemplateText);
      }
      const parsedDate = parseLocalDate(justDate, false);
      if (!Number.isNaN(+parsedDate)) {
        return;
      }
      const [day, month, year] = justDate.split(/[ /,.-]/);
      if (!day || !month || !year) {
        console.log('Invalid date', date, page.title);
        return;
      }
      const localDate = getLocalDate(`${year.padStart(4, '20')}-${month}-${day}`);
      if (!localDate) {
        console.log('Invalid date', date, page.title);
        return;
      }
      const newTemplateText = haaretzTemplate.replace(date, localDate);
      newContent = newContent.replace(haaretzTemplate, newTemplateText);
    });
    if (newContent !== content) {
      await api.updateArticle(page.title, 'תבנית הארץ: תיקון פורמט תאריך', newContent);
      console.log('Updated', page.title);
    }
  });
}
