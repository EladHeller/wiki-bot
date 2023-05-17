import 'dotenv/config';
import {
  getArticleContent,
  getMayaLinks, login, updateArticle,
} from './wiki/wikiAPI';
import {
  TableRow,
  buildTableWithStyle,
} from './wiki/WikiParser';
import { WikiPage } from './types';
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from './wiki/newTemplateParser';
import parseTableText from './wiki/wikiTableParser';
import { AllDetailsResponse, getAllDetails } from './API/mayaAPI';

type JobChange = '-' | 'לא קיים בערך' | 'כן' | 'כנראה שכן' | 'כנראה שלא'| 'לא ידוע' | 'לא קיים במאי״ה';

const LOG_ARTICLE_NAME = 'user:sapper-bot/פרטי חברה';
const TEMPLATE_NAME = 'חברה מסחרית';

interface ManagementDetails {
  chairman?: string;
  articleChairman?: string;
  chairmanEqual?: JobChange;
  CEO?: string;
  articleCEO?: string;
  CEOEqual?: JobChange;
  address?: string;
  title: string;
  id: number;
  isCrosslisted?: boolean;
  manualApproval?: boolean;
 }

function getWordsEquals(articleJob: string, mayaJob: string) : boolean {
  const jobWords = mayaJob.trim().split(' ');
  return jobWords.filter((word) => articleJob.includes(word)).length >= 2;
}

function getJobChange(articleJob: string, mayaJob: string): JobChange {
  if (!articleJob && !mayaJob) {
    return '-';
  }
  if (!articleJob) {
    return 'לא קיים בערך';
  }
  if (!mayaJob) {
    return 'לא קיים במאי״ה';
  }
  if (
    articleJob.localeCompare(mayaJob) === 0
   || articleJob.includes(mayaJob)
    || mayaJob.includes(articleJob)) {
    return 'כן';
  }
  if (getWordsEquals(articleJob, mayaJob)) {
    return 'כנראה שכן';
  }
  return 'כנראה שלא';
}

function getCompanyDetails(
  allDetails: AllDetailsResponse,
  page: WikiPage,
  template: Record<string, string>,
  tableRow?: ManagementDetails,
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
  const articleChairman = template['יו"ר'];
  const articleCEO = template['מנכ"ל'];
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
    manualApproval: tableRow?.manualApproval,
  };
}
function getRowStyle(ceuEqual?: JobChange, chairmanEqual?: JobChange) {
  if (ceuEqual === 'כן' && chairmanEqual === 'כן') {
    return 'bgcolor="#ccffcc"';
  }

  const possibleStatuses: JobChange[] = ['כן', 'כנראה שכן'];

  if (possibleStatuses.includes(ceuEqual ?? '-') && possibleStatuses.includes(chairmanEqual ?? '-')) {
    return 'bgcolor="ffffcc"';
  }
  return undefined;
}

function getManualApprovalText(manualApproval?: boolean): string {
  if (manualApproval == null) {
    return '';
  }
  return manualApproval ? 'V' : 'X';
}

function getManualApprovalValue(manualApproval?: string) {
  if (!manualApproval) {
    return undefined;
  }
  return manualApproval === 'V' || manualApproval === 'v';
}

async function saveCompanyDetails(details:ManagementDetails[]) {
  const rows = details.map(({
    chairman, articleChairman, CEO, articleCEO, title,
    chairmanEqual, CEOEqual, manualApproval,
  }): TableRow => {
    const needApprovalStauses = ['כנראה שלא', 'כנראה שכן'];
    const isApprovalNeeded = needApprovalStauses.includes(chairmanEqual ?? '')
     || needApprovalStauses.includes(CEOEqual ?? '');
    const row = [
      `[[${title}]]`,
      chairman ?? '',
      articleChairman ?? '',
      chairmanEqual ?? '',
      CEO ?? '',
      articleCEO ?? '',
      CEOEqual ?? '',
      isApprovalNeeded ? getManualApprovalText(manualApproval) : '-',
    ];
    const fields = row.map((x) => x ?? '').map((x) => x.replace(/,(\S)/g, ', $1'));
    return {
      fields,
      style: getRowStyle(CEOEqual, chairmanEqual),
    };
  });
  const tableText = buildTableWithStyle(
    ['שם החברה', 'יושב ראש', 'יושב ראש בערך', 'יושב ראש זהה?', 'מנכל', 'מנכל בערך', 'מנכל זהה?', 'אישור ידני'],
    rows,
  );
  const explanation = 'בעמודת אישור ידני יש לסמן V אם רוצים שהבוט יעדכן את הערך ו-X אם רוצים שהבוט לא יעדכן את הערך. בשורות שבהן אין צורך באישור יופיע -\nֿ\n';
  await updateArticle(LOG_ARTICLE_NAME, 'פרטי חברה', explanation + tableText);
}

async function getTableData() : Promise<ManagementDetails[]> {
  const text = await getArticleContent(LOG_ARTICLE_NAME);
  if (!text) {
    throw new Error('No text');
  }
  const [table] = parseTableText(text);
  table.rows.shift(); // remove header
  const data = table.rows.map((row) => {
    const [
      name, chairman, articleChairman, chairmanEqual, CEO, articleCEO, CEOEqual, manualApproval,
    ] = row.values;
    return {
      id: 0,
      title: name.replace(/\[\[(.+?)\]\]/, '$1'),
      chairman,
      articleChairman,
      chairmanEqual: chairmanEqual as JobChange,
      CEO,
      articleCEO,
      CEOEqual: CEOEqual as JobChange,
      manualApproval: getManualApprovalValue(manualApproval),
    };
  });

  return data;
}

async function updateIfNeeded(
  page: WikiPage,
  template: Record<string, string>,
  templateText: string,
  companyDetails: ManagementDetails,
) {
  const content = page.revisions?.[0].slots.main['*'];
  const cloneTemplate = { ...template };
  let needUpdate = false;
  if (companyDetails.CEOEqual === 'לא קיים בערך' && companyDetails.CEO) {
    needUpdate = true;
    cloneTemplate['מנכ"ל'] = companyDetails.CEO;
  }
  if (companyDetails.chairmanEqual === 'לא קיים בערך' && companyDetails.chairman) {
    needUpdate = true;
    cloneTemplate['יו"ר'] = companyDetails.chairman;
  }

  if (needUpdate && content) {
    const newTemplateText = templateFromKeyValueData(cloneTemplate, TEMPLATE_NAME);
    const newContent = content.replace(templateText, newTemplateText);
    if (newContent !== content) {
      console.log('Update', page.title);
      await updateArticle(page.title, 'פרטי חברה', newContent);
    }
  }
}

async function main() {
  await login();
  console.log('Login success');

  const tableData = await getTableData();

  const results = await getMayaLinks(true);
  // await fs.writeFile('./maya-links.json', JSON.stringify(results, null, 2));
  const managementDetails:ManagementDetails[] = [];
  try {
    for (const page of Object.values(results)) {
      const res = await getAllDetails(page);
      const isDeleted = res?.allDetails?.CompanyDetails?.CompanyIndicators.some(({ Key, Value }) => Key === 'DELETED' && Value === true);
      const content = page.revisions?.[0].slots.main['*'];
      const templateText = content && findTemplate(content, TEMPLATE_NAME, page.title);
      const template = templateText && getTemplateKeyValueData(templateText);

      if (res && !isDeleted && template) {
        const tableRow = tableData.find(({ title }) => title === page.title);
        const companyDetails = getCompanyDetails(res, page, template, tableRow);
        await updateIfNeeded(page, template, templateText, companyDetails);
        managementDetails.push(companyDetails);
      } else if (isDeleted) {
        console.log(`${page.title} is deleted`);
      } else if (!template) {
        console.log(`${page.title} has no template`);
      } else {
        console.log(`${page.title} has no data`);
      }
    }
  } catch (error) {
    console.log(error?.data ?? error?.message ?? error);
  }

  // await fs.writeFile('./res-management.json', JSON.stringify(managementDetails, null, 2));
  await saveCompanyDetails(managementDetails);
}

main().catch((error) => {
  console.log(error?.data ?? error?.message ?? error);
});
