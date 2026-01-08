import axios, { type AxiosResponse } from 'axios';
import { logger } from '../utilities/logger';

const jsonLink = 'https://mayaapi.tase.co.il/api/company/financereports?companyId=';
const jsonAllLink = 'https://mayaapi.tase.co.il/api/company/alldetails?companyId=';
const indicesListApiUrl = 'https://api.tase.co.il/api/index/indiceslistfornavigator?idxId=undefined&lang=0';
const indexComponentsApiUrl = 'https://api.tase.co.il/api/index/components';

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

const mayaPostOptions = {
  method: 'post',
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
};

type CompanyData = {
  Title: string | null;
  Rows: [];
};
type ComponyRow = {
  SectionId: number;
  Code: string;
  Name: string;
  CurrPeriodValue: string;
  PrevPeriodValue: string;
  PrevYearValue: string;
};
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
  AllRows: ComponyRow[];
  LastReports: {
    RptCd: number;
    Title: string;
    PubDate: string;
    CompanyId: number;
    StatusDesc: string;
  }[];
};

export type MayaAllDetails = {
  CompanyDetails: {
    CompanyLongName: string;
    Description: string;
    CorporateNo: string;
    MarketValue: number;
    SuperBranch: string;
    Branch: string;
    SubBranch: string;
    Logo: string;
    LogoTitle: string;
    TaseHebLogo: string;
    TaseEngLogo: string;
    RepresentativeName?: string;
    CorrectionDate: string;
    IsBondCompany: boolean;
    ToHideDeletedCompany: boolean;
    HideFinanceSection: boolean;
    IsNonListed: boolean;
    IsTaseUp: boolean;
    IsCandidate: boolean;
    Address: string;
    ZIP: string;
    City: string;
    Tel: string;
    Fax: string;
    Email: string;
    Site: string;
    IncorporationPlace: string;
    CompanyIndicators: {
        Key: string;
        Value: boolean;
        Desc: string;
    }[];
    IndicatorToDisplay: string;
    ShowAnalysis: boolean;
    CompanyId: number;
    CompanyName: string;
    Title?: string;
    EngTitle?: string;
    TradeActiveDay: number;
  };
  IndicesList: [{
    SecurityId: number;
    SecurityName: string;
    Symbol: string;
    IndexName: string;
    Weight: number;
    FactorWeight?: number;
  }];
  ManagementDetails: {
    UpdateDate: string;
    ManagementAndSeniorExecutives: [{
        Id: string;
        Name: string;
        RoleType: string;
        IsManager: boolean;
        SecurityName: string;
        EndBalance: string;
        LastBalanceDate: string;
        CapitalPercent: string;
        VoteCapital: string;
        IsFinancialExpert: number;
        IsInspectionComitee: number;
    }];
  };
};

export type MayaMarketValue = {
  marketValue: number;
  correctionDate: string;
  title?: string;
  wikiDataId?: string;
  id: number;
  companyLongName?: string;
};

export interface SymbolResult {
  id: string;
  symbol?: string;
  englishSymbol?: string;
  hebrewName: string;
  englishName: string;
}

type Index = {
  TradeDate: string;
  TradeTime: string;
  Name: string;
  Id: string;
  IndexId: string;
  IndexHebName: string;
  LastRate: number;
  Change: number;
  Turnover: number;
  Gainers: number;
  Decliners: number;
  NoChanges: number;
  TradingStage: string;
  TradingStageDesc: string;
  TradingStageMob: string;
  InDay: number;
  IndexCategoryType: string;
  CategoryName: string;
  IsRezef: number;
  IsBond: boolean;
  MarketOpen: boolean;
}

type Stock = {
  ShortName: string;
  Symbol: string;
  CompanyId: number;
  Weight: number;
}

export async function getIndicesList(): Promise<Index[]> {
  try {
    const response = await axios(indicesListApiUrl, mayaGetOptions);
    return response.data?.NavCmpnIndicesData;
  } catch (e) {
    logger.logError(
      `getIndicesList error: ${e?.data || e?.message || e}`,
    );
    throw e;
  }
}

export async function getIndexStocks(indexId: string): Promise<Stock[]> {
  try {
    const items: Array<any> = [];
    let response: AxiosResponse<any, any> | null = null;
    let pageNum = 1;
    while (!response || response.data?.Items?.length === 30) {
      response = await axios(indexComponentsApiUrl, {
        ...mayaPostOptions,
        data: {
          oId: indexId,
          pageNum,
          lang: '0',
        },
      });
      if (response?.data?.Items?.length) {
        items.push(...response.data.Items);
      }
      pageNum += 1;
    }
    return items;
  } catch (e) {
    logger.logError(
      `getIndicesList error: ${e?.data || e?.message || e}`,
    );
    throw e;
  }
}

export async function getMarketValueById(
  companyId: string | number,
): Promise<MayaMarketValue | undefined> {
  const url = jsonAllLink + companyId;

  try {
    const response = await axios(url, mayaGetOptions);
    const result = response.data;
    if (!result) {
      return undefined;
    }

    return {
      marketValue: result.CompanyDetails?.MarketValue,
      correctionDate: result.CompanyDetails?.CorrectionDate,
      id: result.CompanyDetails?.CompanyId,
      companyLongName: result.CompanyDetails?.CompanyLongName,
    };
  } catch (e) {
    logger.logError(
      `companyAllDetailsUrl: ${companyId}. ${e?.data || e?.message || e}`,
    );
    throw e;
  }
}

export async function getSymbol(
  companyId: string | number,
): Promise<SymbolResult> {
  const url = jsonAllLink + companyId;

  try {
    const result = await axios(url, mayaGetOptions);
    const enResult = await axios(url, {
      ...mayaGetOptions,
      headers: {
        ...mayaGetOptions.headers,
        'accept-language': 'en-US',
      },
    });
    const allDetails: MayaAllDetails = result.data;
    const enAllDetails: MayaAllDetails = enResult.data;
    const indice = allDetails.IndicesList.find(({ IndexName }) => IndexName === 'ת"א All-Share');
    const enIndice = enAllDetails.IndicesList.find(({ IndexName }) => IndexName === 'TA-All-Share');

    return {
      id: result?.data?.CompanyDetails?.CompanyId,
      symbol: indice?.Symbol,
      englishSymbol: enIndice?.Symbol,
      englishName: enAllDetails.CompanyDetails.CompanyLongName,
      hebrewName: allDetails.CompanyDetails.CompanyLongName,
    };
  } catch (e) {
    logger.logError(
      `companyAllDetailsUrl: ${companyId}. ${e?.data || e?.message || e}`,
    );
    throw e;
  }
}

export async function getAllDetails(
  companyId: string | number,
): Promise<MayaAllDetails | undefined> {
  const url = jsonAllLink + companyId;
  try {
    const results = await axios(url, mayaGetOptions);
    return results?.data;
  } catch (e) {
    logger.logError(
      `companyAllDetailsUrl: ${companyId}. ${e?.data || e?.message || e}`,
    );
    throw e;
  }
}

export async function getFinanceReport(
  companyId: string,
): Promise<MayaCompany | undefined> {
  const companyFinnaceDetailsUrl = jsonLink + companyId;
  try {
    const result = await axios(companyFinnaceDetailsUrl, mayaGetOptions);
    return result?.data;
  } catch (e) {
    logger.logError(
      `companyFinnaceDetailsUrl: ${companyId}. ${e?.data || e?.message || e}`,
    );
    throw e;
  }
}
