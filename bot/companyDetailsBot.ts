import 'dotenv/config';
import fs from 'node:fs/promises';
import { AllDetailsResponse, getAllDetails } from './mayaAPI';
import {
  getMayaLinks, login, updateArticle,
} from './wiki/wikiAPI';
import { buildTable } from './wiki/WikiParser';
import { WikiPage } from './types';
import { findTemplate, getTemplateKeyValueData } from './wiki/newTemplateParser';

type JobChange = '-' | 'לא קיים בערך' | 'כן' | 'כנראה שכן' | 'לא'| 'לא ידוע' | 'לא קיים במאי״ה';

interface ManagementDetails {
  chairman?: string;
  articleChairman?: string;
  chairmanEqual?: string;
  CEO?: string;
  articleCEO?: string;
  CEOEqual?: string;
  address: string;
  title: string;
  id: number;
  isCrosslisted: boolean;
 }

function getJobChange(articleJob: string, mayaJob: string): JobChange {
  if (!articleJob && !mayaJob) {
    return '-';
  } if (!articleJob) {
    return 'לא קיים בערך';
  } if (!mayaJob) {
    return 'לא קיים במאי״ה';
  } if (articleJob === mayaJob || articleJob.includes(mayaJob) || mayaJob.includes(articleJob)) {
    return 'כן';
  }
  return 'לא';
}

function getCompanyDetails(
  allDetails: AllDetailsResponse,
  page: WikiPage,
): ManagementDetails {
  const chairman = allDetails.allDetails.ManagementDetails.ManagementAndSeniorExecutives
    .filter(({ RoleType }) => RoleType === 'יו"ר דירקטוריון'
     || RoleType.match(/^יו"ר דירקטוריון\sו/)
     || RoleType.match(/^יו"ר דירקטוריון\sפעיל/)
     || RoleType.match(/^יו"ר דירקטוריון\sמשותף/)
      || RoleType.endsWith('ויו"ר דירקטוריון'))
    .map(({ Name }) => Name)
    .filter((name, i, arr) => arr.indexOf(name) === i)
    .join(', ');
  const CEO = allDetails.allDetails.ManagementDetails.ManagementAndSeniorExecutives
    .filter(({ RoleType }) => RoleType === 'מנהל כללי'
    || RoleType === 'מנכ"ל'
    || RoleType.match(/^מנכ"ל\sו/)
    || RoleType.match(/^מנהל כללי\sו/)
    || RoleType.endsWith('ומנהל כללי')
     || RoleType.endsWith('ומנכ"ל'))
    .map(({ Name }) => Name)
    .filter((name, i, arr) => arr.indexOf(name) === i)
    .join(', ');
  const address = `${allDetails.allDetails.CompanyDetails.Address}, ${allDetails.allDetails.CompanyDetails.City}`;
  const content = page.revisions?.[0].slots.main['*'];
  const template = content && getTemplateKeyValueData(findTemplate(content, 'חברה מסחרית', page.title));
  const articleChairman = template?.['יו"ר'];
  const articleCEO = template?.['מנכ"ל'];
  return {
    chairman,
    articleChairman,
    chairmanEqual: getJobChange(articleChairman, chairman),
    CEO,
    articleCEO,
    CEOEqual: getJobChange(articleCEO, CEO),
    address,
    title: page.title,
    id: page.pageid,
    isCrosslisted: allDetails.allDetails.CompanyDetails.CompanyIndicators
      .find(({ Key }) => Key === 'DUALI')?.Value ?? false,
  };
}

async function saveCompanyDetails(details:ManagementDetails[]) {
  const rows = details.map(({
    chairman, articleChairman, CEO, articleCEO, address, title, isCrosslisted,
    chairmanEqual, CEOEqual,
  }) => {
    const row = [
      `[[${title}]]`,
      isCrosslisted ? 'כן' : 'לא',
      chairman ?? '',
      articleChairman ?? '',
      chairmanEqual ?? '',
      CEO ?? '',
      articleCEO ?? '',
      CEOEqual ?? '',
      address.replace(/^, /, ''),
      '',
    ];
    return row.map((x) => x ?? '').map((x) => x.replace(/,(\S)/g, ', $1'));
  });
  const tableText = buildTable(
    ['שם החברה', 'דואלית', 'יושב ראש', 'יושב ראש בערך', 'יושב ראש זהה?', 'מנכל', 'מנכל בערך', 'מנכל זהה?', 'כתובת', 'אישור ידני'],
    rows,
  );
  await updateArticle('user:sapper-bot/פרטי חברה', 'פרטי חברה', tableText);
}

export async function main1() {
  await login();
  console.log('Login success');

  const results = await getMayaLinks(true);
  await fs.writeFile('./maya-links.json', JSON.stringify(results, null, 2));
  const managementDetails:ManagementDetails[] = [];
  try {
    for (const page of Object.values(results)) {
      const res = await getAllDetails(page);
      const isDeleted = res?.allDetails?.CompanyDetails?.CompanyIndicators.some(({ Key, Value }) => Key === 'DELETED' && Value === true);
      if (res && !isDeleted) {
        console.log(page.title);
        managementDetails.push(getCompanyDetails(res, page));
      }
    }
  } catch (error) {
    console.log(error?.data ?? error?.message ?? error);
  }

  await fs.writeFile('./res-management.json', JSON.stringify(managementDetails, null, 2));
  await saveCompanyDetails(managementDetails);
}

export async function main() {
  await login();
  console.log('Login success');

  const results: Record<string, WikiPage> = JSON.parse(await fs.readFile('./maya-links.json', 'utf-8'));
  const managementDetails:ManagementDetails[] = JSON.parse(await fs.readFile('./res-management.json', 'utf-8'));
  try {
    for (const page of Object.values(results)) {
      const res = await getAllDetails(page);
      if (res) {
        console.log(page.title);
        managementDetails.push(getCompanyDetails(res, page));
      }
    }
  } catch (error) {
    console.log(error?.data ?? error?.message ?? error);
  }
  await saveCompanyDetails(managementDetails);
}

main1().catch((error) => {
  console.log(error?.data ?? error?.message ?? error);
});
