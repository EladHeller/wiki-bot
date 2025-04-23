import {
  getAllDetails,
} from '../API/mayaAPI';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import WikiApi from '../wiki/WikiApi';
import { querySparql } from '../wiki/WikidataAPI';
import { companiesWithMayaId } from '../wiki/WikiDataSqlQueries';
import { promiseSequence } from '../utilities';

type CompanyData = {
  title: string;
  revid: number;
  text: string;
};

async function main() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');
  const query = companiesWithMayaId();
  const wikiDataResults = await querySparql(query);
  const results: CompanyData[] = [];
  await promiseSequence(1, wikiDataResults.map((result) => async () => {
    const allDetails = await getAllDetails(result.mayaId);
    if (!allDetails) {
      console.error(`No details for company ${result.companyName}`);
      return;
    }
    const { content, revid } = await api.articleContent(result.articleName);
    const indice = allDetails.IndicesList.find(({ IndexName }) => IndexName === 'ת"א All-Share');
    if (!content || !revid) {
      throw new Error(`No content or revid for page ${result.articleName}`);
    }
    const oldTemplate = findTemplate(content, 'חברה מסחרית', result.articleName);
    const templateData = getTemplateKeyValueData(oldTemplate);
    templateData['בורסה'] = '[[הבורסה לניירות ערך בתל אביב]]';
    if (indice?.Symbol) {
      templateData['סימול'] = indice?.Symbol;
    }
    results.push({
      title: result.articleName,
      revid,
      text: content.replace(oldTemplate, templateFromKeyValueData(templateData, 'חברה מסחרית')),
    });
  }));

  for (let i = 10; i < results.length; i += 1) {
    await api.edit(results[i].title, 'נתוני בורסה', results[i].text, results[i].revid);
    console.log(results[i].title);
  }
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
