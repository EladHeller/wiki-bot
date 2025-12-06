import { jest } from '@jest/globals';
import { IWikiDataAPI } from '../../bot/wiki/WikidataAPI';
import { Mocked } from './types';
import {
  WikiDataClaim,
  WikiDataEntity,
  WikiDataSetClaimResponse,
  WikiDataSetReferenceResponse,
  WikiDataSnack,
} from '../../bot/types';

export default function WikiDataApiMock(base: Partial<Mocked<IWikiDataAPI>> = {}): Mocked<IWikiDataAPI> {
  return {
    login: base.login ?? jest.fn<() => Promise<void>>(),
    setClaimValue: base.setClaimValue
      ?? jest.fn<(claim: string, value: any, summary: string, baserevid: number) =>
        Promise<WikiDataSetClaimResponse>>(),
    setClaim: base.setClaim
      ?? jest.fn<(claim: WikiDataClaim, summary: string, baserevid: number) =>
        Promise<WikiDataSetClaimResponse>>(),
    getClaim: base.getClaim
      ?? jest.fn<(entity: string, property: string) => Promise<WikiDataClaim[]>>(),
    readEntity: base.readEntity
      ?? jest.fn<(qid: string, props: string, languages?: string) => Promise<WikiDataEntity>>(),
    getRevId: base.getRevId
      ?? jest.fn<(title: string) => Promise<number>>(),
    updateReference: base.updateReference
      ?? jest.fn<(claim: string, referenceHash: string,
        snaks: Record<string, WikiDataSnack[]>, summary: string, baserevid: number) =>
        Promise<WikiDataSetReferenceResponse>>(),
  };
}
