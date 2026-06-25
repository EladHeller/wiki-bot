import {
  describe, expect, it,
} from '@jest/globals';
import {
  fixKnessetBillLinksInContent,
  processKnessetBillLinksPage,
} from '../scripts/oneTime/knessetBillLinks';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { WikiPage } from '../types';

function page(content: string, revid = 123): WikiPage {
  return {
    pageid: 1,
    ns: 0,
    title: 'ערך',
    extlinks: [],
    revisions: [{
      user: 'user',
      size: content.length,
      revid,
      slots: {
        main: {
          contentmodel: 'wikitext',
          contentformat: 'text/x-wiki',
          '*': content,
        },
      },
    }],
  };
}

describe('fixKnessetBillLinksInContent', () => {
  it('should fix law suggestions search links', () => {
    const content = '[https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=2072953 הצעת החוק]';

    expect(fixKnessetBillLinksInContent(content))
      .toBe('[https://main.knesset.gov.il/apps/legislation/main/bills/2072953 הצעת החוק]');
  });

  it('should fix LawReshumot links', () => {
    const content = '{{הערה|[https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=LawReshumot&lawitemid=487036 רשומות]}}';

    expect(fixKnessetBillLinksInContent(content))
      .toBe('{{הערה|[https://main.knesset.gov.il/apps/legislation/main/bills/487036 רשומות]}}');
  });

  it('should fix lowercase path links', () => {
    const content = 'https://main.knesset.gov.il/activity/legislation/laws/pages/lawbill.aspx?t=lawsuggestionssearch&lawitemid=155306';

    expect(fixKnessetBillLinksInContent(content))
      .toBe('https://main.knesset.gov.il/apps/legislation/main/bills/155306');
  });

  it('should support query parameters in any order and html escaped separators', () => {
    const content = 'https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?lawitemid=155306&amp;t=LawReshumot';

    expect(fixKnessetBillLinksInContent(content))
      .toBe('https://main.knesset.gov.il/apps/legislation/main/bills/155306');
  });

  it('should not change unsupported links', () => {
    const content = [
      'https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=Other&lawitemid=155306',
      'https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=LawReshumot',
      'https://main.knesset.gov.il/apps/legislation/main/bills/155306',
    ].join('\n');

    expect(fixKnessetBillLinksInContent(content)).toBe(content);
  });
});

describe('processKnessetBillLinksPage', () => {
  it('should edit changed pages', async () => {
    const api = WikiApiMock();
    const content = 'https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=2072953';

    await expect(processKnessetBillLinksPage(api, page(content))).resolves.toBe(true);

    expect(api.edit).toHaveBeenCalledWith(
      'ערך',
      'תיקון קישורים להצעות חוק באתר הכנסת',
      'https://main.knesset.gov.il/apps/legislation/main/bills/2072953',
      123,
    );
  });

  it('should skip unchanged pages', async () => {
    const api = WikiApiMock();
    const content = 'https://main.knesset.gov.il/apps/legislation/main/bills/2072953';

    await expect(processKnessetBillLinksPage(api, page(content))).resolves.toBe(false);

    expect(api.edit).not.toHaveBeenCalled();
  });

  it('should skip pages without revision content', async () => {
    const api = WikiApiMock();

    await expect(processKnessetBillLinksPage(api, {
      pageid: 1, ns: 0, title: 'ערך', extlinks: [],
    })).resolves.toBe(false);

    expect(api.edit).not.toHaveBeenCalled();
  });
});
