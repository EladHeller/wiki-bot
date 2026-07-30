import type { IWikiApi } from '../../wiki/WikiApi';

export default function NewCategoriesModel(api: IWikiApi) {
  async function getCategoriesCreatedIn(date: string) {
    const titles: string[] = [];
    const generator = api.searchPages(`creationdate:${date}`, [14], 500);
    for await (const pages of generator) {
      titles.push(...pages.map((page) => page.title));
    }

    return titles;
  }

  async function updateNewCategories() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const categories = await getCategoriesCreatedIn(currentMonth);

    const newCategoriesPageTitle = 'ויקיפדיה:קטגוריות חדשות';
    const newCategoriesContent = categories.map((c) => `* [[:${c}]]`).join('\n');
    const { content, revid } = await api.articleContent(newCategoriesPageTitle);

    const newContent = content.replaceAll(/\* \[\[:קטגוריה:.*\n?/g, '') + newCategoriesContent;
    if (newContent !== content) {
      await api.edit(newCategoriesPageTitle, 'עדכון קטגוריות חדשות', newContent, revid);
    }
  }

  async function createPerMonthIfNeeded(date: Date) {
    const monthPageTitleString = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    const monthSearchString = date.toISOString().slice(0, 7);
    const title = `ויקיפדיה:קטגוריות לפי זמן יצירתם/${monthPageTitleString}`;

    const [info] = await api.info([title]);
    if (!('missing' in info)) {
      return;
    }

    const categories = await getCategoriesCreatedIn(monthSearchString);
    const content = categories.map((c) => `* [[:${c}]]`).join('\n');
    await api.create(title, `קטגוריות שנוצרו בחודש ${monthPageTitleString}`, content);
  }

  async function createLastMonthCategoriesPageIfNeeded() {
    const lastMonth = new Date();
    lastMonth.setDate(1);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await createPerMonthIfNeeded(lastMonth);
  }

  return {
    getCategoriesCreatedIn,
    updateNewCategories,
    createPerMonthIfNeeded,
    createLastMonthCategoriesPageIfNeeded,
  };
}
