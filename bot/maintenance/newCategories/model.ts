import type { IWikiApi } from '../../wiki/WikiApi';

const yearlyCategoriesParent = 'קטגוריה:ויקיפדיה:קטגוריות לפי זמן יצירתם';

export default function NewCategoriesModel(api: IWikiApi) {
  async function getCategoriesCreatedIn(date: string) {
    const titles: string[] = [];
    const generator = api.searchPages(`creationdate:${date}`, [14], 500);
    for await (const pages of generator) {
      titles.push(...pages.map((page) => page.title));
    }

    return titles.sort((a, b) => a.localeCompare(b));
  }

  async function updateNewCategories() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const categories = await getCategoriesCreatedIn(currentMonth);

    const newCategoriesPageTitle = 'ויקיפדיה:קטגוריות חדשות';
    const newCategoriesContent = categories.map((c) => `* [[:${c}]]\n`).join('');
    const { content, revid } = await api.articleContent(newCategoriesPageTitle);

    const newContent = content.replace(/(\* \[\[:קטגוריה:.*\n?)+/, newCategoriesContent);
    if (newContent !== content) {
      await api.edit(newCategoriesPageTitle, 'עדכון קטגוריות חדשות', newContent, revid);
    }
  }

  async function createPerMonthIfNeeded(date: Date, edit = false) {
    const monthPageTitleString = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    const monthSearchString = date.toISOString().slice(0, 7);
    const title = `ויקיפדיה:קטגוריות לפי זמן יצירתם/${monthPageTitleString}`;
    const year = date.getFullYear();
    const yearCategoryTitle = `${yearlyCategoriesParent} (${year})`;

    const [info] = await api.info([title]);
    if (!('missing' in info) && !edit) {
      return;
    }

    const [yearCategoryInfo] = await api.info([yearCategoryTitle]);
    if ('missing' in yearCategoryInfo) {
      await api.create(
        yearCategoryTitle,
        `יצירת קטגוריה לשנת ${year}`,
        `[[${yearlyCategoriesParent}]]`,
      );
    }

    const categories = await getCategoriesCreatedIn(monthSearchString);
    const prefix = `בחודש ${monthPageTitleString} נוצרו ${categories.length} קטגוריות:`;
    const categoriesContent = categories.map((c) => `* [[:${c}]]`).join('\n');
    const category = `[[${yearCategoryTitle}]]`;
    const content = `${prefix}\n${categoriesContent}\n\n${category}`;
    if (edit) {
      await api.edit(title, `קטגוריות שנוצרו בחודש ${monthPageTitleString}`, content, info.lastrevid ?? -1);
    } else {
      await api.create(title, `קטגוריות שנוצרו בחודש ${monthPageTitleString}`, content);
    }
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
