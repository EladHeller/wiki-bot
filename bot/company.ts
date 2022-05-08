import { MayaCompany } from './mayaAPI';
import { updateArticle, WikiPage } from './wikiAPI';
import WikiTemplateParser from './WikiTemplateParser';

const currentYear = process.env.YEAR;
const TEMPLATE_NAME = 'חברה מסחרית';
const lossStr = 'הפסד של';
const thousandStr = '1000 (מספר)|אלף';
const millionStr = 'מיליון';
const milliardStr = 'מיליארד';
const NIS = 'ש"ח';
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
  fieldData: string, year: number, reference: string, name: string, isFirst: boolean,
) {
  let finalString = '';

  if (fieldData) {
    let fixedFieldData = fieldData.trim().replace(/,/g, '');

    if (fieldData.startsWith('-')) {
      finalString += `${lossStr} `;
      fixedFieldData = fixedFieldData.substring(1);
    }

    let order = '';
    let sumStr;
    if (fixedFieldData === '0') {
      sumStr = fixedFieldData;
    } else if (fixedFieldData.length < 4) {
      order = thousandStr;
      sumStr = fixedFieldData;
    } else if (fixedFieldData.length < 10) {
      order = fixedFieldData.length < 7 ? millionStr : milliardStr;
      sumStr = fixedFieldData.substring(0, 3);
      const remind = fixedFieldData.length % 3;
      if (remind) {
        sumStr = [sumStr.slice(0, remind), '.', sumStr.slice(remind)].join('');
      }
    } else {
      order = milliardStr;
      sumStr = Number(fixedFieldData.substring(0, fixedFieldData.length - 6)).toLocaleString();
    }
    const commentKey = `דוח${year}-${name}`;
    const comment = `{{הערה|שם=${commentKey}${isFirst ? `|1=${name}: [${reference.replace(companyReportView, companyFinanceView)} נתונים כספיים] באתר [[מאי"ה]].` : ''}}}`;
    finalString += `${sumStr} ${order ? `[[${order}]]` : ''} [[${NIS}]] ([[${year}]])${comment}`;
  }

  return finalString;
}

export default class Company {
  name: string;

  mayaDataForWiki: Record<string, any>;

  wikiTemplateData: Record<string, any>

  isContainsTamplate: boolean;

  articleText: string;

  reference: string;

  templateParser: WikiTemplateParser;

  newArticleText: string;

  hasData: boolean;

  marketValue: number;

  constructor(name: string, mayData: MayaCompany, wikiData: WikiPage, marketValue: number) {
    this.name = name;
    this.marketValue = marketValue;
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
        );

        isFirst = false;
        this.templateParser.templateData[field.wikiName] = this.wikiTemplateData[field.wikiName] || '';
      }
    });

    if (this.marketValue) {
      this.templateParser.templateData['שווי'] = getFieldString(
        this.marketValue.toString(),
        this.wikiTemplateData.year,
        this.reference,
        this.templateParser.templateData[NAME_FIELD] || NAME_STRING,
        false,
      );
    }

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

    this.wikiTemplateData.year = year;
  }
}
