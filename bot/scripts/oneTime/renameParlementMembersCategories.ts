import { WikiPage } from '../../types';
import type { IWikiApi } from '../../wiki/WikiApi';

const changes: string[][] = [];
const pagesToChange = new Map<string, WikiPage>();

async function renameCategory(api: IWikiApi, oldCategory: string, newCategory: string, reason: string) {
  changes.push([oldCategory, newCategory]);
  await api.movePage(oldCategory, newCategory, reason);
  const generator = api.categroyPages(oldCategory.replace('קטגוריה:', '').replace('חברי הכנסת מטעם', 'חברי כנסת מטעם').replace('חברות הכנסת מטעם', 'חברות כנסת מטעם'), 10);
  for await (const pages of generator) {
    for (const page of pages) {
      pagesToChange.set(page.title, page);
    }
  }
}

export default async function renameParlementMembersCategories(api: IWikiApi) {
  await api.login();
  const logs: string[] = [];
  const genereator = api.recursiveSubCategories('חברי הכנסת לפי סיעה');
  for await (const member of genereator) {
    const male = !member.title.includes('חברות כנסת');
    const newTitle = member.title.replace('חברי כנסת', 'חברי הכנסת').replace('חברות כנסת', 'חברות הכנסת');
    try {
      await renameCategory(api, member.title, newTitle, male ? 'שינוי שם: חברי כנסת לחברי הכנסת' : 'שינוי שם: חברות כנסת לחברות הכנסת');
    } catch (e) {
      console.error(e);
      logs.push(`Error in category ${member.title}: ${e}`);
    }
  }
  for (const [, page] of pagesToChange) {
    const revision = page.revisions?.[0];
    if (revision?.revid) {
      let newContent = revision.slots.main['*'];
      const isMale = !(newContent.includes('קטגוריה:חברות כנסת מטעם') || newContent.includes('קטגוריה:חברות הכנסת מטעם'));
      for (const [oldCategory, newCategory] of changes) {
        const old = oldCategory.replace('חברי הכנסת מטעם', 'חברי כנסת מטעם').replace('חברות הכנסת מטעם', 'חברות כנסת מטעם');
        newContent = newContent.replaceAll(old, newCategory);
      }
      try {
        if (newContent !== revision.slots.main['*']) {
          await api.edit(page.title, isMale ? 'שינוי שם: חברי כנסת לחברי הכנסת' : 'שינוי שם: חברות כנסת לחברות הכנסת', newContent, revision.revid);
        } else {
          console.error('No change in page', page.title);
        }
      } catch (e) {
        console.error(e);
        logs.push(`Error in page ${page.title}: ${e}`);
      }
    } else {
      console.error('No revision for page', page.title);
      logs.push(`Error: No revision for page ${page.title}`);
    }
  }

  for (const [oldCategory] of changes) {
    const old = oldCategory.replace('חברי הכנסת מטעם', 'חברי כנסת מטעם').replace('חברות הכנסת מטעם', 'חברות כנסת מטעם');
    const isMale = !old.includes('חברות כנסת');

    try {
      const contentResult = await api.articleContent(old);
      if (!contentResult) {
        throw new Error(`No content for page ${old}`);
      }
      const { content } = contentResult;
      if (!content.includes('#הפניה [[:קטגוריה')) {
        throw new Error(`No reference for page ${oldCategory}`);
      }
      const generator = api.listCategory(old.replace('קטגוריה:', ''), 5000);
      for await (const pages of generator) {
        if (pages.length) {
          throw new Error(`Category ${oldCategory} is not empty`);
        }
      }
      await api.deletePage(old, isMale ? 'שינוי שם: חברי כנסת לחברי הכנסת' : 'שינוי שם: חברות כנסת לחברות הכנסת');
    } catch (e) {
      console.error(e);
      logs.push(`Error in category ${old}: ${e}`);
    }
  }

  return logs;
}
