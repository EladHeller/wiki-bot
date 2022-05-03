import axios from 'axios';
import { WikiPage } from './wikiAPI';

const mayaLinkRegex = /^http:\/\/maya\.tase\.co\.il\/company\/(\d*)\?view=reports$/;
const jsonLink = 'https://mayaapi.tase.co.il/api/company/financereports?companyId=';
const companyPageLink = 'http://maya.tase.co.il/company/';
const companyReportView = '?view=reports';
const mayaGetOptions = {
  method: 'get',
  credentials: 'include',
  headers: {
    'X-Maya-With': 'allow',
    origin: 'https://maya.tase.co.il',
    referer: 'https://maya.tase.co.il/',
    accept: 'application/json',
    authority: 'mayaapi.tase.co.il',
  },
};

type Periond = {
  Title: string;
  Year: number;
  IFRS: boolean;
  IsPreview: boolean;
}

type CompanyData = {
  Title: string | null,
  Rows: [];
}
type ComponyRow = {
  SectionId: number,
  Code: string;
  Name: string;
  CurrPeriodValue: string;
  PrevPeriodValue: string;
  PrevYearValue: string;
}
export type MayaCompany = {
  CurrentPeriod: Periond;
  PreviousPeriod: Periond;
  PreviousYear: Periond;
  CurrencyCode: number;
  CurrencyName: string;
  Factor: number;
  CompanyShortName: string;
  IsPeriod: boolean;
  Balance: CompanyData;
  ProfitReport: CompanyData;
  AdditionalData: CompanyData;
  FinancialRatios: CompanyData;
  AllRows: ComponyRow[],
  LastReports: {
      RptCd: number,
      Title: string;
      PubDate: string;
      CompanyId: number;
      StatusDesc: string;
  }[]
};

export type MayaWithWiki = {
  maya: MayaCompany;
  wiki: WikiPage;
}

export default async function getMayaDetails(
  wikiPage: WikiPage,
): Promise<MayaWithWiki | undefined> {
  const extLink = wikiPage.extlinks?.find((link) => link['*'].match(mayaLinkRegex))?.['*'];
  if (!extLink) {
    console.error('No extlinks', wikiPage.title, wikiPage.extlinks);
    return undefined;
  }
  const companyFinnaceDetailsUrl = extLink.replace(companyPageLink, jsonLink).replace(companyReportView, '');

  return axios(companyFinnaceDetailsUrl, mayaGetOptions)
    .then((result) => ({
      maya: result.data,
      wiki: wikiPage,
    }))
    .catch((e) => {
      console.error(e?.data || e?.message || e);
      return undefined;
    });
}
