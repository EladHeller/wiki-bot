import { asyncGeneratorMapWithSequence } from '../../utilities';
import WikiApi from '../../wiki/WikiApi';

const TEMPLATE_NAME = 'צ-ספר';
const targetReplace = 'אוצר הכתובות|';
const regex = /צ-ספר\|מחבר=\[\[נחום סלושץ\]\]\|שם=אוצר הכתובות הפניקיות\|מו"ל=דביר\|שנת הוצאה=(1942|תש"ב)\|עמ=/g;

export default async function replaceToOtzarHaktovot() {
  const api = WikiApi();
  await api.login();

  await asyncGeneratorMapWithSequence(10, api.getArticlesWithTemplate(TEMPLATE_NAME), (page) => async () => {
    const content = page.revisions?.[0].slots.main['*'];
    if (!content) {
      console.log('No content for', page.title);
      return;
    }
    const revid = page.revisions?.[0].revid;
    if (!revid) {
      console.log('No revid for', page.title);
      return;
    }

    const newContent = content.replace(regex, targetReplace);
    if (newContent !== content) {
      await api.edit(page.title, 'החלפת תבנית צ-ספר לאוצר הכתובות', newContent, revid);
      console.log('Changed', page.title);
    }
  });
}
