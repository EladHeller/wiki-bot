import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import BaseWikiApi from '../../wiki/BaseWikiApi';
import AiGeneratedImagesModel from './AiGeneratedImagesModel';
import injectionDecorator, { CallbackArgs } from '../../decorators/injectionDecorator';
import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import { buildTable } from '../../wiki/wikiTableParser';

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const TARGET_PAGE = 'ויקיפדיה:תחזוקה/תמונות שנוצרו על ידי בינה מלאכותית';

export async function updateHebrewWikiList(pagesWithAiImages: Record<string, string[]>, heWikiApi: IWikiApi) {
  let content = 'דף זה מכיל רשימה של דפים בוויקיפדיה העברית המשתמשים בתמונות שנוצרו על ידי בינה מלאכותית מוויקישיתוף.\n\n';
  content += `הנתונים נכונים ל-${new Date().toLocaleDateString('he-IL')}.\n\n`;

  const sortedPages = Object.keys(pagesWithAiImages).sort();
  const rows = sortedPages.map((page) => {
    const images = pagesWithAiImages[page].map((img) => {
      const display = img.replace('File:', '');
      return `[[:${img}|${display}]]`;
    }).join(', ');
    return [`[[${page}]]`, images];
  });

  content += buildTable(['דף', 'תמונות'], rows);

  await heWikiApi.login();
  let currentContent = '';
  let revid = 0;
  try {
    const res = await heWikiApi.articleContent(TARGET_PAGE);
    currentContent = res.content;
    revid = res.revid;
  } catch {
    currentContent = '';
    revid = 0;
  }

  if (currentContent === content) {
    console.log('No changes detected in AI-generated images list.');
    return;
  }

  if (revid > 0) {
    await heWikiApi.edit(TARGET_PAGE, 'עדכון רשימת דפים עם תמונות בינה מלאכותית', content, revid);
  } else {
    await heWikiApi.create(TARGET_PAGE, 'עדכון רשימת דפים עם תמונות בינה מלאכותית', content);
  }
  console.log(`Updated AI-generated images list on ${TARGET_PAGE}`);
}

export async function aiGeneratedImagesBot(heWikiApi: IWikiApi) {
  const commonsApi = WikiApi(BaseWikiApi({
    baseUrl: COMMONS_API_URL,
    assertBot: false,
  }));
  const model = AiGeneratedImagesModel(commonsApi);
  const pagesWithAiImages = await model.getAiGeneratedImagesFromCommons();
  await updateHebrewWikiList(pagesWithAiImages, heWikiApi);
}

export const main = botLoggerDecorator(injectionDecorator(async ({ wikiApi }: CallbackArgs) => {
  await aiGeneratedImagesBot(wikiApi as IWikiApi);
}), { botName: 'בוט תמונות בינה מלאכותית' });
