import axios from 'axios';
import { WikiPage } from './wikiAPI';

const mayaLinkRegex = /^http:\/\/maya\.tase\.co\.il\/company\/(\d*)\?view=reports$/;
const jsonLink = 'https://mayaapi.tase.co.il/api/company/financereports?companyId=';
const jsonAllLink = 'https://mayaapi.tase.co.il/api/company/alldetails?companyId=';
const companyPageLink = 'http://maya.tase.co.il/company/';
const companyReportView = '?view=reports';
const mayaGetOptions = {
  method: 'get',
  credentials: 'include',
  headers: {
    'X-Maya-With': 'allow',
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
  companyId: number;
}

export type MayaMarketValue = {
  marketValue: number;
  correctionDate: string;
  title?: string;
  id: number;
}

export async function getMarketValue(
  wikiPage: Partial<WikiPage>,
): Promise<MayaMarketValue | undefined> {
  const extLink = wikiPage.extlinks?.find((link) => link['*'].match(mayaLinkRegex))?.['*'];
  if (!extLink) {
    throw new Error(`No extlinks: ${wikiPage.title} ${wikiPage.extlinks}`);
  }
  const companyAllDetailsUrl = extLink.replace(companyPageLink, jsonAllLink).replace(companyReportView, '');

  return axios(companyAllDetailsUrl, mayaGetOptions).catch((e) => {
    console.error('companyAllDetailsUrl', wikiPage.title, e?.data || e?.message || e);
    throw e;
  })
    .then((result) => ({
      marketValue: result?.data?.CompanyDetails?.MarketValue,
      correctionDate: result?.data?.CompanyDetails?.CorrectionDate,
      title: wikiPage.title,
      id: result?.data?.CompanyDetails?.CompanyId,
    }));
}

export default async function getMayaDetails(
  wikiPage: WikiPage,
): Promise<MayaWithWiki | undefined> {
  const extLink = wikiPage.extlinks?.find((link) => link['*'].match(mayaLinkRegex))?.['*'];
  if (!extLink) {
    console.error('No extlinks', wikiPage.title, wikiPage.extlinks);
    return undefined;
  }
  const companyId = Number(extLink.replace(companyPageLink, '').replace(companyReportView, ''));
  const companyFinnaceDetailsUrl = extLink.replace(companyPageLink, jsonLink).replace(companyReportView, '');

  return axios(companyFinnaceDetailsUrl, mayaGetOptions).catch((e) => {
    console.error('companyFinnaceDetailsUrl', wikiPage.title, e?.data || e?.message || e);
    throw e;
  })
    .then((result) => ({
      maya: result?.data,
      companyId,
      wiki: wikiPage,
    }))
    .catch((e) => {
      console.error(wikiPage.title, e?.data || e?.message || e);
      return undefined;
    });
}
