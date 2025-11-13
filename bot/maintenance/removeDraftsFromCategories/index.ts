import shabathProtectorDecorator from '../../decorators/shabathProtector';
import WikiApi from '../../wiki/WikiApi';
import getDrafts from './getDrafts';

export async function removeDraftsFromCategories() {
  const api = WikiApi();
  await api.login();
  const drafts = await getDrafts();
  for (const draft of drafts) {
    const { content, revid } = await api.articleContent(draft);
    const newContent = content.replaceAll('[[קטגוריה:', '[[:קטגוריה:');
    if (newContent !== content) {
      await api.edit(draft, 'הסרת דף טיוטה מקטגוריה של מרחב הערכים', newContent, revid);
    }
    console.log(`Processed ${draft}`);
  }
  console.log('Done');
}

export const main = shabathProtectorDecorator(removeDraftsFromCategories);
