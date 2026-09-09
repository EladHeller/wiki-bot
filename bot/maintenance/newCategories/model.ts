import type { IWikiApi } from '../../wiki/WikiApi';
import type { LogEvent, WikiPage } from '../../types';

const yearlyCategoriesParent = 'קטגוריה:ויקיפדיה:קטגוריות לפי זמן יצירתם';

export default function NewCategoriesModel(api: IWikiApi) {
  async function wasCategoryDeletedAfterTalkPageCreation(categoryTitle: string, year: number) {
    const talkTitle = categoryTitle.replace(/^קטגוריה:/, 'שיחת קטגוריה:');
    const result = await api.request('?action=query&format=json&prop=revisions'
      + `&titles=${encodeURIComponent(talkTitle)}&rvprop=timestamp&rvlimit=1&rvdir=newer`
      + '&list=logevents&leaction=delete%2Fdelete&leprop=timestamp&lelimit=1&ledir=older'
      + `&letitle=${encodeURIComponent(categoryTitle)}`);
    const pages = Object.values(result.query?.pages ?? {}) as WikiPage[];
    const createdAt = pages[0]?.revisions?.[0]?.timestamp;
    if (!createdAt) {
      throw new Error(`Could not determine creation date for ${talkTitle}`);
    }
    const logs: LogEvent[] = result.query?.logevents ?? [];
    return createdAt.startsWith(`${String(year).padStart(4, '0')}-`)
      && logs.some((log) => log.timestamp !== undefined && log.timestamp >= createdAt);
  }

  async function getDeletedCategoriesForTalkPagesCreatedIn(year: number): Promise<string[]> {
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      throw new Error('Year must be an integer between 1 and 9999');
    }
    const deletedCategories = new Set<string>();
    const checkedCategories = new Set<string>();
    const generator = api.searchPages(`creationdate:${year}`, [15], 500);
    for await (const pages of generator) {
      const titles = [...new Set(pages.map((page) => page.title.replace(/^שיחת קטגוריה:/, 'קטגוריה:')))]
        .filter((title) => !checkedCategories.has(title));
      for (let offset = 0; offset < titles.length; offset += 50) {
        const batch = titles.slice(offset, offset + 50);
        const info = await api.info(batch);
        const missingTitles = info.filter((page) => 'missing' in page)
          .map((page) => page.title)
          .filter((title): title is string => title !== undefined);
        for (const title of missingTitles) {
          if (await wasCategoryDeletedAfterTalkPageCreation(title, year)) {
            deletedCategories.add(title);
          }
        }
        batch.forEach((title) => checkedCategories.add(title));
      }
    }
    return [...deletedCategories].sort((a, b) => a.localeCompare(b));
  }

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

  async function createYearCategoryIfNeeded(year: number) {
    const title = `${yearlyCategoriesParent} (${year})`;
    const [info] = await api.info([title]);
    if (!('missing' in info)) {
      return title;
    }

    await api.create(
      title,
      `יצירת קטגוריה לשנת ${year}`,
      `[[${yearlyCategoriesParent}]]`,
    );
    return title;
  }

  async function createPerMonthIfNeeded(date: Date, edit = false) {
    const monthPageTitleString = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    const monthSearchString = date.toISOString().slice(0, 7);
    const title = `ויקיפדיה:קטגוריות לפי זמן יצירתם/${monthPageTitleString}`;
    const year = date.getFullYear();

    const [info] = await api.info([title]);
    if (!('missing' in info) && !edit) {
      return;
    }

    const yearCategoryTitle = await createYearCategoryIfNeeded(year);

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

  async function createPerYearIfNeeded(date: Date, edit = false) {
    const year = date.getFullYear();
    const title = `ויקיפדיה:קטגוריות לפי זמן יצירתם/${year}`;
    const [info] = await api.info([title]);
    if (!('missing' in info) && !edit) {
      return;
    }

    const yearCategoryTitle = await createYearCategoryIfNeeded(year);
    const categories = await getCategoriesCreatedIn(year.toString());
    const prefix = `בשנת ${year} נוצרו ${categories.length} קטגוריות:`;
    const categoriesContent = categories.map((category) => `* [[:${category}]]`).join('\n');
    const content = `${prefix}\n${categoriesContent}\n\n[[${yearCategoryTitle}]]`;
    const summary = `קטגוריות שנוצרו בשנת ${year}`;
    if (edit) {
      await api.edit(title, summary, content, info.lastrevid ?? -1);
    } else {
      await api.create(title, summary, content);
    }
  }

  async function createLastMonthCategoriesPageIfNeeded() {
    const lastMonth = new Date();
    lastMonth.setDate(1);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await createPerMonthIfNeeded(lastMonth);
  }

  async function createLastYearCategoriesPageIfNeeded() {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    await createPerYearIfNeeded(lastYear);
  }

  return {
    getDeletedCategoriesForTalkPagesCreatedIn,
    getCategoriesCreatedIn,
    updateNewCategories,
    createYearCategoryIfNeeded,
    createPerMonthIfNeeded,
    createPerYearIfNeeded,
    createLastMonthCategoriesPageIfNeeded,
    createLastYearCategoriesPageIfNeeded,
  };
}
