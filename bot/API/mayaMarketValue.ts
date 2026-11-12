import axios from 'axios';
import { logger } from '../utilities/logger';

export type MayaMarketValue = {
  marketValue: number | null;
  correctionDate: string;
  title?: string;
  wikiDataId?: string;
  id: number;
  companyLongName?: string;
};

type MayaCompanyDetails = {
  companyId: number;
  longName: string;
  marketValue: number | null;
  securitiesValidityDate: string;
};

export async function getMarketValueById(companyId: string | number): Promise<MayaMarketValue> {
  const url = `https://maya.tase.co.il/api/v1/companies/${encodeURIComponent(companyId)}/details`;

  try {
    const { data } = await axios.get<MayaCompanyDetails | null>(url, {
      headers: { Accept: 'application/json', 'Accept-Language': 'he' },
    });
    if (
      data?.companyId !== Number(companyId)
      || typeof data.longName !== 'string'
      || (data.marketValue !== null && !Number.isFinite(data.marketValue))
      || typeof data.securitiesValidityDate !== 'string'
      || !Number.isFinite(Date.parse(data.securitiesValidityDate))
    ) {
      throw new Error(`Invalid Maya company details for ${companyId}`);
    }

    return {
      id: data.companyId,
      companyLongName: data.longName,
      marketValue: data.marketValue,
      correctionDate: data.securitiesValidityDate,
    };
  } catch (error) {
    logger.logError(`Maya company details request failed for ${companyId}: ${error}`);
    throw error;
  }
}
