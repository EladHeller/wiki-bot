import { MayaCompany } from '../mayaAPI';
import { WikiPage } from '../types';
import { CurrencyCode, prettyNumericValue } from '../utilities';
import { updateArticle } from '../wikiAPI';
import WikiTemplateParser from '../WikiTemplateParser';

const currentYear = process.env.YEAR;
const TEMPLATE_NAME = 'חברה מסחרית';
const lossStr = 'הפסד של';

const fieldsForWiki = [
  { mayaName: ['סה"כ הכנסות'], wikiName: 'הכנסה' },
  { mayaName: ['רווח תפעולי'], wikiName: 'רווח תפעולי' },
  { mayaName: ['רווח נקי', 'רווח נקי מיוחס לבעלי המניות'], wikiName: 'רווח' },
  { mayaName: ['הון עצמי', 'הון עצמי מיוחס לבעלי המניות'], wikiName: 'הון עצמי' },
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

  isContainsTamplate: boolean;

  articleText: string;

  reference: string;

  templateParser: WikiTemplateParser;

  newArticleText: string;

  hasData: boolean;

  companyId: number;

  currency: CurrencyCode;

  revisionSize: number;

  constructor(
    name: string,
    mayData: MayaCompany,
    wikiData: WikiPage,
    companyId: number,
  ) {
    this.revisionSize = wikiData.revisions[0].size;
    this.companyId = companyId;
    this.name = name;
    this.currency = currencyDict[mayData.CurrencyName];
    if (!this.currency) {
      throw new Error(`${name}: Currency missing!`);
    }
    const mayaDetails = new Map();
    let rowsField = '';
    let periodField = 'CurrentPeriod';
    if (mayData.PreviousYear.Title === `שנתי ${currentYear}`) {
      rowsField = 'PrevYearValue';
      periodField = 'PreviousYear';
    } else if (mayData.CurrentPeriod.Title === `שנתי ${currentYear}`) {
      periodField = 'CurrentPeriod';
      rowsField = 'CurrPeriodValue';
    }
    mayData.AllRows.forEach((row) => {
      mayaDetails.set(row.Name, row[rowsField]);
    });
    const mayaYear = mayData[periodField].Year;

    this.appendMayaData(mayaDetails, mayaYear);
    this.appendWikiData(wikiData);
    this.updateWikiTamplate();
  }

  updateCompanyArticle() {
    return updateArticle(this.name, 'עדכון תבנית:חברה מסחרית', this.newArticleText);
  }

  updateWikiTamplate() {
    let isFirst = true;
    fieldsForWiki.forEach((field) => {
      const fieldData = this.mayaDataForWiki[field.wikiName];
      if (fieldData) {
        this.wikiTemplateData[field.wikiName] = getFieldString(
          fieldData,
          this.wikiTemplateData.year,
          this.reference,
          this.templateParser.templateData[NAME_FIELD] || NAME_STRING,
          isFirst,
          this.currency,
        );

        isFirst = false;
        this.templateParser.templateData[field.wikiName] = this.wikiTemplateData[field.wikiName] || '';
      }
    });

    const oldTemplate = this.templateParser.templateText;
    this.templateParser.updateTamplateFromData();
    if (this.isContainsTamplate) {
      this.newArticleText = this.articleText.replace(oldTemplate, this.templateParser.templateText);
      // If not contains template and not has other template
    } else if (!this.articleText.trim().startsWith('{')) {
      this.newArticleText = `${this.templateParser.templateText}\n${this.articleText}`;
    }
  }

  appendWikiData(wikiData: WikiPage) {
    this.isContainsTamplate = 'templates' in wikiData;
    this.articleText = wikiData.revisions[0].slots.main['*'];
    this.reference = wikiData.extlinks[0]['*'];
    this.templateParser = new WikiTemplateParser(this.articleText, TEMPLATE_NAME);
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
