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
      const justDate = date.replace('{{כ}}', '').replace('פורסם ב-', '');
      const parsedDate = parseLocalDate(justDate, false);
      if (!Number.isNaN(+parsedDate)) {
        return;
      }
      const [day, month, year] = justDate.split(/[ /,.-]/);
      if (!day || !month || !year) {
        console.log('Invalid date', date);
        return;
      }
      const localDate = getLocalDate(`${year.padStart(4, '20')}-${month}-${day}`);
      if (!localDate) {
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
