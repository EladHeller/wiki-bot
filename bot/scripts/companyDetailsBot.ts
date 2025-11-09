/* eslint-disable no-param-reassign */
import { findTemplate, getTemplateKeyValueData, templateFromKeyValueData } from '../wiki/newTemplateParser';
import parseTableText, { TableRow, buildTableWithStyle } from '../wiki/wikiTableParser';
import { getAllDetails, MayaAllDetails } from '../API/mayaAPI';
import { getUsersFromTagParagraph } from '../wiki/paragraphParser';
import { getLocalDate } from '../utilities';
import { isTwoWordsIsTheSamePerson } from '../API/openai';
import WikiApi, { IWikiApi } from '../wiki/WikiApi';
import { companiesWithMayaId, CompaniesWithMayaIdResult } from '../wiki/WikidataSparql';

type JobChange = '-' | 'לא קיים בערך' | 'כן' | 'כנראה שכן' | 'כנראה שלא'| 'לא ידוע' | 'לא קיים במאי״ה';
const notApplicapble: JobChange[] = ['לא קיים במאי״ה', 'לא ידוע', '-'];

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
  isCrosslisted?: boolean;
  manualApproval?: boolean;
 }

function getWordsEquals(articleJob: string, mayaJob: string) : boolean {
  const jobWords = mayaJob.trim().split(' ');
  return jobWords.filter((word) => articleJob.includes(word)).length >= 2;
}

async function getJobChange(articleJob: string, mayaJob: string): Promise<JobChange> {
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
    || mayaJob.includes(articleJob)
    || await isTwoWordsIsTheSamePerson(articleJob, mayaJob)) {
    return 'כן';
  }
  if (getWordsEquals(articleJob, mayaJob)) {
    return 'כנראה שכן';
  }
  return 'כנראה שלא';
}

async function getCompanyDetails(
  allDetails: MayaAllDetails,
  title: string,
  template: Record<string, string>,
  tableRow?: ManagementDetails,
): Promise<Promise<ManagementDetails>> {
  const chairman = allDetails.ManagementDetails.ManagementAndSeniorExecutives
    .filter(({ RoleType }) => RoleType === 'יו"ר דירקטוריון'
     || RoleType.match(/^יו"ר דירקטוריון\sו/)
     || RoleType.match(/^יו"ר דירקטוריון\sפעיל/)
     || RoleType.match(/^יו"ר דירקטוריון\sמשותף/)
      || RoleType.endsWith('ויו"ר דירקטוריון'))
    .map(({ Name }) => Name)
    .filter((name, i, arr) => arr.indexOf(name) === i)
    .join(', ')
    .trim()
    .replace(/\n/g, '');
  const CEO = allDetails.ManagementDetails.ManagementAndSeniorExecutives
    .filter(({ RoleType }) => RoleType === 'מנהל כללי'
    || RoleType === 'מנכ"ל'
    || RoleType.match(/^מנכ"ל\sו/)
    || RoleType.match(/^מנהל כללי\sו/)
    || RoleType.endsWith('ומנהל כללי')
     || RoleType.endsWith('ומנכ"ל'))
    .map(({ Name }) => Name)
    .filter((name, i, arr) => arr.indexOf(name) === i)
    .join(', ')
    .trim()
    .replace(/\n/g, '');
  const address = `${allDetails.CompanyDetails.Address}, ${allDetails.CompanyDetails.City}`;
  const articleChairman = template['יו"ר']?.trim().replace(/\n/g, '');
  const articleCEO = template['מנכ"ל']?.trim().replace(/\n/g, '');
  const chairmenChanged = chairman !== tableRow?.chairman
   || articleChairman !== tableRow?.articleChairman;
  const CEOChanged = CEO !== tableRow?.CEO || articleCEO !== tableRow?.articleCEO;
  return {
    chairman,
    articleChairman,
    chairmanEqual: !chairmenChanged
      ? tableRow.chairmanEqual : await getJobChange(articleChairman, chairman),
    CEO,
    articleCEO,
    CEOEqual: !CEOChanged ? tableRow.CEOEqual : await getJobChange(articleCEO, CEO),
    address,
    title,
    isCrosslisted: allDetails.CompanyDetails.CompanyIndicators
      .find(({ Key }) => Key === 'DUALI')?.Value ?? false,
    manualApproval: (chairmenChanged || CEOChanged) ? undefined : tableRow?.manualApproval,
  };
}
function getRowStyle(ceoEqual?: JobChange, chairmanEqual?: JobChange) {
  if (ceoEqual === 'כן' && chairmanEqual === 'כן') {
    return 'bgcolor="#ccffcc"';
  }

  const possibleStatuses: JobChange[] = ['כן', 'כנראה שכן'];

  if (possibleStatuses.includes(ceoEqual ?? '-') && possibleStatuses.includes(chairmanEqual ?? '-')) {
    return 'bgcolor="ffffcc"';
  }
  return undefined;
}

function getManualApprovalText(
  manualApproval?: boolean,
  ceoEqual?: JobChange,
  chairmanEqual?: JobChange,
): string {
  if (ceoEqual === 'כן' && chairmanEqual === 'כן') {
    return 'Y';
  }
  if (notApplicapble.includes(ceoEqual ?? '-') && notApplicapble.includes(chairmanEqual ?? '-')) {
    return 'N/A';
  }
  const needApprovalStauses: JobChange[] = ['כנראה שלא', 'כנראה שכן', 'לא קיים בערך'];
  const isApprovalNeeded = needApprovalStauses.includes(chairmanEqual ?? '-')
     || needApprovalStauses.includes(ceoEqual ?? '-');
  if (!isApprovalNeeded) {
    return 'N/A';
  }
  if (manualApproval == null) {
    return '';
  }
  return manualApproval ? 'V' : 'X';
}

function getManualApprovalValue(manualApproval?: string) {
  if (manualApproval === 'V' || manualApproval === 'v') {
    return true;
  }
  if (manualApproval === 'X' || manualApproval === 'x') {
    return false;
  }
  return undefined;
}

async function saveCompanyDetails(api: IWikiApi, tableRevid: number, details:ManagementDetails[]) {
  const rows = details
    .map(({
      chairman, articleChairman, CEO, articleCEO, title,
      chairmanEqual, CEOEqual, manualApproval,
    }): TableRow | undefined => {
      const manualApprovalText = getManualApprovalText(manualApproval, CEOEqual, chairmanEqual);
      if (['Y', 'N/A'].includes(manualApprovalText)) {
        return undefined;
      }
      const row = [
        `[[${title}]]`,
        chairman ?? '',
        articleChairman ?? '',
        chairmanEqual ?? '',
        CEO ?? '',
        articleCEO ?? '',
        CEOEqual ?? '',
        manualApprovalText,
      ];
      const fields = row.map((x) => x ?? '').map((x) => x.replace(/,(\S)/g, ', $1'));
      return {
        fields,
        style: getRowStyle(CEOEqual, chairmanEqual),
      };
    }).filter((x) : x is TableRow => x != null).sort((a, b) => {
      const aManualApproval = a.fields.at(-1) ?? '';
      const bManualApproval = b.fields.at(-1) ?? '';
      return aManualApproval.toString().localeCompare(bManualApproval.toString());
    });

  const tableText = buildTableWithStyle(
    ['שם החברה', 'יושב ראש', 'יושב ראש בערך', 'יושב ראש זהה?', 'מנכל', 'מנכל בערך', 'מנכל זהה?', 'אישור ידני'],
    rows,
  );
  const explanation = `עמודת אישור ידני:
{{ש}}'''Y''' - שני הערכים זהים.
{{ש}}'''N/A''' - לא נדרשת שום פעולה.
{{ש}}בתאים הריקים צריך לסמן אחד משתי האפשרויות:
{{ש}}'''X''' - לסמן לבוט לא לעדכן את הערך.
{{ש}}'''V''' - לסמן לבוט לעדכן את הערך.
{{ש}}אישור ידני משפיע רק על ערכים שאינם זהים (כנראה שכן, כנראה שלא ולא קיים בערך)

`;
  return api.edit(LOG_ARTICLE_NAME, 'פרטי חברה', explanation + tableText, tableRevid);
}

async function getTableData(api: IWikiApi) : Promise<{data:ManagementDetails[], tableRevid: number}> {
  const { content, revid } = await api.articleContent(LOG_ARTICLE_NAME);
  const [table] = parseTableText(content);
  table.rows.shift(); // remove header
  const data = table.rows.map((row) => {
    const [
      name, chairman, articleChairman, chairmanEqual, CEO, articleCEO, CEOEqual, manualApproval,
    ] = row.fields;
    return {
      id: 0,
      title: name.toString().replace(/\[\[(.+?)\]\]/, '$1'),
      chairman: chairman.toString(),
      articleChairman: articleChairman.toString(),
      chairmanEqual: chairmanEqual as JobChange,
      CEO: CEO.toString(),
      articleCEO: articleCEO.toString(),
      CEOEqual: CEOEqual as JobChange,
      manualApproval: getManualApprovalValue(manualApproval.toString()),
    };
  });

  return { data, tableRevid: revid };
}

async function updateIfNeeded(
  api: IWikiApi,
  title: string,
  content: string,
  revid: number,
  template: Record<string, string>,
  templateText: string,
  companyDetails: ManagementDetails,
) {
  const cloneTemplate = { ...template };
  let needUpdate = false;

  const subjectToChangeStatsuses: JobChange[] = ['כנראה שכן', 'כנראה שלא', 'לא קיים בערך'];

  const needToUpdateCEO = (companyDetails.manualApproval && subjectToChangeStatsuses.includes(companyDetails.CEOEqual ?? '-'));
  if (needToUpdateCEO && companyDetails.CEO) {
    needUpdate = true;
    cloneTemplate['מנכ"ל'] = companyDetails.CEO;
    companyDetails.articleCEO = companyDetails.CEO;
    companyDetails.CEOEqual = 'כן';
  }
  const needToUpdateChairman = (companyDetails.manualApproval && subjectToChangeStatsuses.includes(companyDetails.chairmanEqual ?? '-'));
  if (needToUpdateChairman && companyDetails.chairman) {
    needUpdate = true;
    cloneTemplate['יו"ר'] = companyDetails.chairman;
    companyDetails.articleChairman = companyDetails.chairman;
    companyDetails.chairmanEqual = 'כן';
  }

  if (needUpdate && content && revid) {
    const newTemplateText = templateFromKeyValueData(cloneTemplate, TEMPLATE_NAME);
    const newContent = content.replace(templateText, newTemplateText);
    if (newContent !== content) {
      console.log('Update', title);
      await api.edit(title, 'פרטי חברה', newContent, revid);
    }
  }
}

async function tagUsers(api: IWikiApi) {
  const page = 'שיחת משתמש:Sapper-bot/פרטי חברה';
  const paragraphName = 'פסקת תיוג';
  const { content, revid } = await api.articleContent(page);
  const users = getUsersFromTagParagraph(content, paragraphName);
  if (users.length === 0) {
    return;
  }
  const localDate = getLocalDate(new Date().toDateString());
  console.log(await api.edit(
    page,
    'תיוג משתמשים',
    `${users.join(',')}, הטבלה עודכנה. ~~~~`,
    revid,
    `ריצה בתאריך - ${localDate}`,
  ));
}

async function getManagmentDetails(
  api: IWikiApi,
  tableData: ManagementDetails[],
  wikiDataResults: CompaniesWithMayaIdResult[],
) {
  const validResults = wikiDataResults.filter((result): result is CompaniesWithMayaIdResult & { articleName: string } => typeof result.articleName === 'string');
  const managementDetails:ManagementDetails[] = [];
  for (const result of validResults) {
    try {
      const { mayaId, articleName } = result;
      const res = await getAllDetails(mayaId);
      const isDeleted = res?.CompanyDetails?.CompanyIndicators.some(({ Key, Value }) => Key === 'DELETED' && Value === true);
      const { content, revid } = await api.articleContent(articleName);
      const templateText = content && findTemplate(content, TEMPLATE_NAME, articleName);
      const template = templateText && getTemplateKeyValueData(templateText);

      if (res && !isDeleted && template) {
        const tableRow = tableData.find(({ title }) => title === articleName);
        const companyDetails = await getCompanyDetails(res, articleName, template, tableRow);
        await updateIfNeeded(api, articleName, content, revid, template, templateText, companyDetails);
        managementDetails.push(companyDetails);
      } else if (isDeleted) {
        console.log(`${articleName} is deleted`);
      } else if (!template) {
        console.log(`${articleName} has no template`);
      } else {
        console.log(`${articleName} has no data`);
      }
    } catch (error) {
      console.log(error?.data ?? error?.message ?? error);
    }
  }

  return managementDetails;
}

export async function companyDetailsBot() {
  const api = WikiApi();
  await api.login();
  console.log('Login success');
  const { data, tableRevid } = await getTableData(api);
  const wikiDataResults = await companiesWithMayaId();
  const managementDetails = await getManagmentDetails(api, data, wikiDataResults);

  const updateResult = await saveCompanyDetails(api, tableRevid, managementDetails);
  const isChanged = !('nochange' in updateResult.edit);
  if (isChanged) {
    await tagUsers(api);
  }
}

export default {
  companyDetailsBot,
};
