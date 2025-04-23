import { MayaCompany } from '../API/mayaAPI';
import { WikiPage } from '../types';
import { CurrencyCode, prettyNumericValue } from '../utilities';
import {
  getTemplateKeyValueData, findTemplates, findTemplate, templateFromKeyValueData,
} from '../wiki/newTemplateParser';
import { IWikiApi } from '../wiki/WikiApi';

const TEMPLATE_NAME = 'חברה מסחרית';
const lossStr = 'הפסד של';

const fieldsForWiki = [
  { mayaName: ['סה"כ הכנסות'], wikiName: 'הכנסה' },
  { mayaName: ['רווח תפעולי'], wikiName: 'רווח תפעולי' },
  { mayaName: ['רווח נקי', 'רווח נקי מיוחס לבעלי המניות'], wikiName: 'רווח' },
  { mayaName: ['הון עצמי', 'הון עצמי מיוחס לבעלי המניות', 'סה"כ הון'], wikiName: 'הון עצמי' },
  { mayaName: ['סך מאזן'], wikiName: 'סך המאזן' },
];
const NAME_FIELD = 'שם';
const NAME_STRING = '{{שם הדף בלי הסוגריים}}';
const companyFinanceView = '?view=finance';
const companyReportView = '?view=reports';

function getFieldString(
  fieldData: string,
  year: number,
  reference: string,
  name: string,
  isFirst: boolean,
  currency: CurrencyCode,
) {
  let finalString = '';

  if (fieldData) {
    let fixedFieldData = fieldData.trim().replace(/,/g, '');

    if (fieldData.startsWith('-')) {
      finalString += `${lossStr} `;
      fixedFieldData = fixedFieldData.substring(1);
    }

    const numericString = prettyNumericValue(fixedFieldData, currency);
    const commentKey = `דוח${year}-${name}`;
    const comment = `{{הערה|שם=${commentKey}${isFirst ? `|1=${name}: [${reference.replace(companyReportView, companyFinanceView)} נתונים כספיים] באתר [[מאי"ה]].` : ''}}}`;
    finalString += `${numericString} ([[${year}]])${comment}`;
  }

  return finalString;
}

const currencyDict: Record<string, CurrencyCode> = {
  '(אלפי דולרים)': 'USD',
  '(אלפי ש"ח)': 'NIS',
  '(  אלפי אירו)': 'EUR',
};

export default class Company {
  name: string;

  mayaId: string;

  mayaDataForWiki: Record<string, any>;

  wikiTemplateData: Record<string, any>;

  isContainsTemplate: boolean;

  articleText: string;

  reference: string;

  templateText: string;

  templateData: Record<string, any>;

  newArticleText: string;

  hasData: boolean;

  companyId: string;

  currency: CurrencyCode;

  revisionSize: number;

  revisionId: number;

  api: IWikiApi;

  currentYear: string;

  constructor(
    name: string,
    mayData: MayaCompany,
    wikiData: WikiPage,
    companyId: string,
    api: IWikiApi,
    year: string,
  ) {
    const revision = wikiData.revisions?.[0];
    if (!revision || !revision.revid) {
      throw new Error(`Missing revision ${name}`);
    }
    this.currentYear = year;
    this.revisionSize = revision.size;
    this.companyId = companyId;
    this.name = name;
    this.api = api;
    this.currency = currencyDict[mayData.CurrencyName];
    if (!this.currency) {
      throw new Error(`${name}: Currency missing!`);
    }
    const mayaDetails = new Map();
    let rowsField = '';
    let periodField = 'CurrentPeriod';
    if (mayData.PreviousYear.Title === `שנתי ${this.currentYear}`) {
      rowsField = 'PrevYearValue';
      periodField = 'PreviousYear';
    } else if (mayData.CurrentPeriod.Title === `שנתי ${this.currentYear}`) {
      periodField = 'CurrentPeriod';
      rowsField = 'CurrPeriodValue';
    }
    mayData.AllRows.forEach((row) => {
      mayaDetails.set(row.Name, row[rowsField]);
    });
    const mayaYear = mayData[periodField].Year;

    this.appendMayaData(mayaDetails, mayaYear);
    this.appendWikiData(wikiData);
    this.updateWikiTemplate();
  }

  updateCompanyArticle() {
    let finalContent = this.newArticleText;
    const references = findTemplates(finalContent, 'הערה', this.name);
    references.forEach((reference) => {
      const referenceData = getTemplateKeyValueData(reference);
      const referenceKey = referenceData.שם;
      const previousYear = Number(this.currentYear) - 1;
      if (referenceKey && referenceKey.startsWith(`דוח${previousYear}-${this.templateData[NAME_FIELD] || NAME_STRING}`)) {
        finalContent = finalContent.replace(reference, '');
      }
    });
    return this.api.edit(this.name, 'עדכון נתוני דוח שנתי לבורסה', finalContent, this.revisionId);
  }

  updateWikiTemplate() {
    let isFirst = true;
    fieldsForWiki.forEach((field) => {
      const fieldData = this.mayaDataForWiki[field.wikiName];
      if (fieldData) {
        this.wikiTemplateData[field.wikiName] = getFieldString(
          fieldData,
          this.wikiTemplateData.year,
          this.reference,
          this.templateData[NAME_FIELD] || NAME_STRING,
          isFirst,
          this.currency,
        );

        isFirst = false;
        this.templateData[field.wikiName] = this.wikiTemplateData[field.wikiName] || '';
      }
    });

    const oldTemplate = this.templateText;
    const newTemplate = templateFromKeyValueData(this.templateData, TEMPLATE_NAME);
    if (this.isContainsTemplate) {
      this.newArticleText = this.articleText.replace(oldTemplate, newTemplate);
      // If not contains template and not has other template
    } else if (!this.articleText.trim().startsWith('{')) {
      this.newArticleText = `${newTemplate}\n${this.articleText}`;
    }
  }

  appendWikiData(wikiData: WikiPage) {
    const revision = wikiData.revisions?.[0];
    if (!revision) {
      throw new Error(`Missing revision for ${this.name}`);
    }
    this.articleText = revision.slots.main['*'];
    this.reference = `https://market.tase.co.il/he/market_data/company/${this.companyId}/financial_reports`;
    this.templateText = findTemplate(this.articleText, TEMPLATE_NAME, this.name);
    this.isContainsTemplate = !!this.templateText;
    this.templateData = getTemplateKeyValueData(this.templateText);
    if (!revision.revid) {
      throw new Error(`Missing revid for ${this.name}`);
    }
    this.revisionId = revision.revid;
  }

  appendMayaData(mayaData: Map<string, any>, year: number) {
    this.mayaDataForWiki = {};
    this.wikiTemplateData = {};
    this.hasData = false;

    fieldsForWiki.forEach((field) => {
      const fieldData = field.mayaName.map((name) => mayaData.get(name)).find((x) => !!x);
      this.hasData = this.hasData || !!fieldData;
      this.mayaDataForWiki[field.wikiName] = fieldData;
    });
    if (this.hasData) {
      this.wikiTemplateData.year = year;
    }
  }
}
