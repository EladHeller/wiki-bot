import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import getDrafts from './getDrafts';

async function removeDraftsFromCategory(draft: string, api: IWikiApi) {
  try {
    const { content, revid } = await api.articleContent(draft);
    const newContent = content.replaceAll('[[קטגוריה:', '[[:קטגוריה:');
    if (newContent === content) {
      console.log(`No changes for draft ${draft}, skipping`);
      return;
    }
    await api.edit(draft, 'הסרת דף טיוטה מקטגוריות של מרחב הערכים', newContent, revid);
    console.log(`Removed draft ${draft} from categories`);
  } catch (error) {
    console.error(`Error removing draft ${draft}`, error);
  }
}

export async function removeDraftsFromCategories() {
  const api = WikiApi();
  await api.login();
  const drafts = await getDrafts();
  for (const draft of drafts) {
    await removeDraftsFromCategory(draft, api);
  }
  console.log('Done');
}

export const main = shabathProtectorDecorator(removeDraftsFromCategories);
