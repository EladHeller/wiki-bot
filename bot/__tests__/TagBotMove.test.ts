import {
  beforeEach, describe, expect, it,
} from '@jest/globals';
import { moveTo } from '../tag-bot/actions/archive';
import { IWikiApi } from '../wiki/WikiApi';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { Mocked } from '../../testConfig/mocks/types';

describe('moveTo', () => {
  let api: Mocked<IWikiApi>;

  beforeEach(() => {
    api = WikiApiMock();
  });

  const userSign = '[[user:Homer Simpson|Homer]] [[user talk:Homer Simpson|Mmmm donats!]] 12:23 7 במאי 2025.';
  const statusTemplate = '{{מצב|טופל|Lisa|ליזה}}';

  it('should move the paragraph successfully to an existing page', async () => {
    api.info.mockResolvedValue([{}]);
    api.articleContent.mockResolvedValue({ content: 'targetContent', revid: 678 });
    api.edit.mockResolvedValue({});

    const paragraphContent = `==paragraph headline==
${statusTemplate}
paragraphContent
:@[[משתמש:Sapper-bot]] העבר: [[שיחת תבנית:ספרינגפילד]] ${userSign}`;
    const pageContent = `some content before\n${paragraphContent}\nsome content after`;

    const result = await moveTo(
      api,
      'Homer Simpson',
      paragraphContent,
      pageContent,
      123,
      'pageTitle',
      'summary',
      '[[שיחת תבנית:ספרינגפילד]]',
    );

    expect(result).toStrictEqual({ success: 'ההעברה בוצעה בהצלחה' });

    expect(api.edit).toHaveBeenCalledWith(
      'שיחת תבנית:ספרינגפילד',
      'summary. הועבר מ[[pageTitle]]',
      `targetContent\n==paragraph headline==\n{{הועבר|מ=pageTitle}}\n${statusTemplate}\nparagraphContent\n\n{{סוף העברה}} הועבר לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~`,
      678,
    );

    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle',
      'summary. הועבר ל[[שיחת תבנית:ספרינגפילד]]',
      pageContent.replace(paragraphContent, ''),
      123,
    );
  });

  it('should move the paragraph successfully to a new page', async () => {
    api.info.mockResolvedValue([{ missing: '1' }]);
    api.create.mockResolvedValue({});
    api.edit.mockResolvedValue({});

    const paragraphContent = `==paragraph headline==
paragraphContent
:@[[משתמש:Sapper-bot]] העבר: [[שיחת תבנית:ספרינגפילד]] ${userSign}`;
    const pageContent = `${paragraphContent}`;

    const result = await moveTo(
      api,
      'Homer Simpson',
      paragraphContent,
      pageContent,
      123,
      'pageTitle',
      'summary',
      'שיחת תבנית:ספרינגפילד',
    );

    expect(result).toStrictEqual({ success: 'ההעברה בוצעה בהצלחה' });

    expect(api.create).toHaveBeenCalledWith(
      'שיחת תבנית:ספרינגפילד',
      'summary. הועבר מ[[pageTitle]]',
      '==paragraph headline==\n{{הועבר|מ=pageTitle}}\nparagraphContent\n\n{{סוף העברה}} הועבר לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~',
    );

    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle',
      'summary. הועבר ל[[שיחת תבנית:ספרינגפילד]]',
      '',
      123,
    );
  });
});
