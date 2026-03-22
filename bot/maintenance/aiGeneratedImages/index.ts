import WikiApi, { IWikiApi } from '../../wiki/WikiApi';
import BaseWikiApi from '../../wiki/BaseWikiApi';
import AiGeneratedImagesModel from './AiGeneratedImagesModel';
import injectionDecorator, { CallbackArgs } from '../../decorators/injectionDecorator';
import botLoggerDecorator from '../../decorators/botLoggerDecorator';
import parseTableText, { buildTable } from '../../wiki/wikiTableParser';

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const TARGET_PAGE = 'ויקיפדיה:תחזוקה/תמונות שנוצרו על ידי בינה מלאכותית';

export async function updateHebrewWikiList(pagesWithAiImages: Map<string, string[]>, heWikiApi: IWikiApi) {
  const sortedPages = Array.from(pagesWithAiImages.keys()).sort();
  const rows = sortedPages.map((page) => {
    const pages = pagesWithAiImages.get(page) || [];
    const images = pages.map((img) => {
      const display = img.replace('File:', '');
      return `[[:${img}|${display}]]`;
    }).join(', ');
    return [`[[${page.replace(/_/g, ' ')}]]`, images];
  });

  const newTable = buildTable(['דף', 'תמונות'], rows);
  const dateStr = new Date().toLocaleDateString('he-IL');
  const dateLine = `הנתונים נכונים ל-${dateStr}.`;

  await heWikiApi.login();
  const res = await heWikiApi.articleContent(TARGET_PAGE);
  const currentContent = res.content || '';
  const { revid } = res;

  let content = '';
  const tables = parseTableText(currentContent);
  if (tables.length > 0) {
    content = currentContent.replace(tables[0].text, newTable);
    const dateRegex = /הנתונים נכונים ל-\d{1,2}[./]\d{1,2}[./]\d{4}\.?/;
    if (dateRegex.test(content)) {
      content = content.replace(dateRegex, dateLine);
    }
  } else {
    content = `${currentContent.trim()}\n\n${dateLine}\n\n${newTable}`;
  }

  if (currentContent === content) {
    console.log('No changes detected in AI-generated images list.');
    return;
  }

  await heWikiApi.edit(TARGET_PAGE, 'עדכון רשימת דפים עם תמונות בינה מלאכותית', content, revid);
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
