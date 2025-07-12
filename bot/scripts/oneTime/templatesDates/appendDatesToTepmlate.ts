import { WikiPage } from '../../../types';
import { asyncGeneratorMapWithSequence, promiseSequence } from '../../../utilities';
import WikiApi from '../../../wiki/WikiApi';
import { findTemplates, getTemplateData, templateFromTemplateData } from '../../../wiki/newTemplateParser';

type DateFromPageCallback = (id: string, title: string, section?: string) => Promise<string>;
type TemplateData = {
    id: string;
    date: string;
    section?: string;
}

function defaultDataFromArrayData(data: string[]): TemplateData {
  const [,, id, date, section] = data;
  return {
    id,
    date,
    section,
  };
}

function defaultToArray(newDate: string, originalArray: string[]): string[] {
  const result = [...originalArray];
  result[3] = newDate;
  return result;
}

export default async function appendDatesToTepmlate(
  templateName: string,
  getDataFromPage: DateFromPageCallback,
  templateNameVersion = templateName,
  dataFromArrayData: (data: string[]) => TemplateData = defaultDataFromArrayData,
  dataToArrayData: (newDate: string, originalArray: string[]) => string[] = defaultToArray,
) {
  let successCount = 0;
  let allCount = 0;
  const api = WikiApi();
  await api.login();
  const generator = api.categroyPages(`שגיאות פרמטריות בתבנית ${templateName} - ללא תאריך`);

  await asyncGeneratorMapWithSequence<WikiPage>(10, generator, (page) => async () => {
    allCount += 1;
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
    await promiseSequence(5, templates.map((template) => async () => {
      const { arrayData, keyValueData } = getTemplateData(
        template,
        templateNameVersion,
        page.title,
      );
      if (!arrayData) {
        return;
      }
      const { id, date, section } = dataFromArrayData(arrayData);
      if (date) {
        return;
      }
      const dateFromDoc = await getDataFromPage(id, page.title, section);
      if (dateFromDoc) {
        const newArrayData = dataToArrayData(dateFromDoc, arrayData);
        const newTemplate = templateFromTemplateData({
          arrayData: newArrayData,
          keyValueData,
        }, templateNameVersion);
        newContent = newContent.replace(template, newTemplate);
      }
    }));

    if (newContent === content) {
      return;
    }
    await api.updateArticle(page.title, `הוספת תאריך לתבנית ${templateName}`, newContent);
    successCount += 1;
    console.log('success', page.title);
  });

  console.log('done', {
    successCount,
    allCount,
  });
}
