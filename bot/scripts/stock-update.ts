import 'dotenv/config';
import fs from 'fs/promises';
import {
  AllDetailsResponse,
  getAllDetails,
} from '../mayaAPI';
import { getCompanies, login } from '../wikiAPI';
import WikiTemplateParser from '../WikiTemplateParser';
import { WikiPage } from '../types';

async function main() {
  await login();
  console.log('Login success');

  const wikiResult = await getCompanies();
  await fs.writeFile('./res.json', JSON.stringify(wikiResult, null, 2), 'utf8');
  const pages: WikiPage[] = Object.values(wikiResult);
  // const pages: WikiPage[] = Object.values(JSON.parse(await fs.readFile('./res.json', 'utf-8')));

  const mayaResults: AllDetailsResponse[] = [];
  for (const page of pages) {
    const res = await getAllDetails(page);
    if (res) {
      console.log(`success ${page.title}`);
      mayaResults.push(res);
    }
  }
  await fs.writeFile('./maya-res.json', JSON.stringify(mayaResults, null, 2), 'utf8');
  const marketValues:AllDetailsResponse[] = JSON.parse(await fs.readFile('./maya-res.json', 'utf8'));
  const results = marketValues.map(({ allDetails, wiki }) => {
    const indice = allDetails.IndicesList.find(({ IndexName }) => IndexName === 'ת"א All-Share');
    const content = wiki.revisions[0].slots.main['*'];
    const template = new WikiTemplateParser(content, 'חברה מסחרית');
    const oldTemplate = template.templateText;
    template.templateData['בורסה'] = '[[הבורסה לניירות ערך בתל אביב]]';
    if (indice?.Symbol) {
      template.templateData['סימול'] = indice?.Symbol;
    }
    return {
      title: wiki.title,
      text: content.replace(oldTemplate, template.updateTamplateFromData()),
    };
  });
  await fs.writeFile('./test-res.json', JSON.stringify(results, null, 2), 'utf8');

  // for (let i = 10; i < results.length; i += 1) {
  //   await updateArticle(results[i].title, 'נתוני בורסה', results[i].text);
  //   console.log(results[i].title);
  // }
}

main().catch((error) => {
  if (error?.data) {
    console.log(error?.data);
  } else if (error?.message) {
    console.log(error?.message);
  } else {
    console.log(error);
  }
});
