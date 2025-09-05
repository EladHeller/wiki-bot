import {
  beforeEach, describe, expect, it,
} from '@jest/globals';
import archiveParagraph from '../tag-bot/actions/archive';
import { IWikiApi } from '../wiki/WikiApi';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { Mocked } from '../../testConfig/mocks/types';

describe('archiveParagraph', () => {
  let api: Mocked<IWikiApi>;

  beforeEach(() => {
    api = WikiApiMock();
  });

  it('should return an error if the archive box is not found', async () => {
    const result = await archiveParagraph(api, 'pageContent', 123, 'pageTitle', 'paragraphContent', 'summary', 'user');

    expect(result).toStrictEqual({ error: 'תיבת ארכיון לא נמצאה' });
  });

  it('should return an error if the archive box content is not found', async () => {
    const archiveBox = '{{תיבת ארכיון}}';

    const result = await archiveParagraph(api, archiveBox, 123, 'pageTitle', 'paragraphContent', 'summary', 'user');

    expect(result).toStrictEqual({ error: 'התוכן של תיבת הארכיון לא נמצא' });
  });

  it('should return an error if no active archive page is found', async () => {
    api.info.mockResolvedValue([{ missing: '' }]);
    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';

    const result = await archiveParagraph(api, archiveBox, 123, 'pageTitle', 'paragraphContent', 'summary', 'user');

    expect(result).toStrictEqual({ error: 'לא נמצא דף ארכיון פעיל' });
  });

  it('should archive the paragraph successfully', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValue({ content: 'existingContent', revid: 456 });
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = 'paragraphContent';
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary', 'user');

    expect(result).toStrictEqual({ success: 'הארכוב בוצע בהצלחה' });

    expect(api.edit).toHaveBeenCalledWith(
      'archiveBoxContent',
      'summary',
      'existingContent\nparagraphContent',
      456,
    );
    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle',
      'summary',
      pageContent.replace(paragraphContent, ''),
      123,
    );
  });

  it('should handle archive page start with /', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValue({ content: 'existingContent', revid: 456 });
    api.edit.mockResolvedValue({});

    const pageTitle = 'pageTitle';
    const archiveBox = '{{תיבת ארכיון|תוכן=[[/archiveBoxContent]]}}';
    const paragraphContent = 'paragraphContent';
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, pageTitle, paragraphContent, 'summary', 'user');

    expect(result).toStrictEqual({ success: 'הארכוב בוצע בהצלחה' });

    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle/archiveBoxContent',
      'summary',
      'existingContent\nparagraphContent',
      456,
    );
    expect(api.edit).toHaveBeenCalledWith(
      pageTitle,
      'summary',
      pageContent.replace(paragraphContent, ''),
      123,
    );
  });

  it('should return an error if an exception occurs', async () => {
    api.info.mockRejectedValue(new Error('Test error'));
    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const result = await archiveParagraph(api, archiveBox, 123, 'pageTitle', 'paragraphContent', 'summary', 'user');

    expect(result).toStrictEqual({ error: 'ארעה שגיאה במהלך האירכוב' });
  });

  const userSign = '[[user:Homer Simpson|Homer]] [[user talk:Homer Simpson|Mmmm donats!]] 12:23 7 במאי 2025.';

  it('should replace archive command with bot comment', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValue({ content: 'existingContent', revid: 456 });
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = `paragraphContent\n:@[[משתמש:Sapper-bot]] ארכב: ${userSign}`;
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary', 'Homer Simpson');

    expect(result).toStrictEqual({ success: 'הארכוב בוצע בהצלחה' });

    expect(api.edit).toHaveBeenCalledWith(
      'archiveBoxContent',
      'summary',
      'existingContent\nparagraphContent\nאורכב לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~',
      456,
    );
    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle',
      'summary',
      pageContent.replace(paragraphContent, ''),
      123,
    );
  });

  const statusTemplate = '{{מצב|טופל|Lisa|ליזה}}';

  it('should archive template with status template', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValueOnce({ content: 'existingContent', revid: 456 });
    api.articleContent.mockResolvedValueOnce({ content: 'targetContent', revid: 678 });
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = `==paragraph headline==
${statusTemplate}
paragraphContent
:@[[משתמש:Sapper-bot]] ארכב:תבנית:[[שיחת תבנית:ספרינגפילד]] ${userSign}`;
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary', 'Homer Simpson', ['יעד', '[[שיחת תבנית:ספרינגפילד]]']);

    expect(result).toStrictEqual({ success: 'הארכוב בוצע בהצלחה' });

    expect(api.edit).toHaveBeenCalledWith(
      'archiveBoxContent',
      'summary',
      `existingContent\n==paragraph headline==
${statusTemplate}
{{הועבר|ל=שיחת תבנית:ספרינגפילד}} אורכב לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~`,
      456,
    );
    expect(api.edit).toHaveBeenCalledWith(
      'שיחת תבנית:ספרינגפילד',
      'summary. הועבר מ[[pageTitle]]',
      `targetContent\n==paragraph headline==\n{{הועבר|מ=pageTitle}}\n${statusTemplate}\nparagraphContent\n\n{{סוף העברה}} אורכב לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~`,
      678,
    );

    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle',
      'summary. הועבר ל[[שיחת תבנית:ספרינגפילד]]',
      pageContent.replace(paragraphContent, ''),
      123,
    );
  });

  it('should return explained error where target page not exists', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValueOnce({ content: 'existingContent', revid: 456 });
    api.articleContent.mockRejectedValueOnce(new Error('Not found'));
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = `==paragraph headline==
${statusTemplate}
paragraphContent
:@[[משתמש:Sapper-bot]] ארכב:תבנית:[[שיחת תבנית:ספרינגפילד]] ${userSign}`;
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary', 'Homer Simpson', ['יעד', '[[שיחת תבנית:ספרינגפילד]]']);

    expect(result).toStrictEqual({ error: 'הבוט לא הצליח למצוא את דף היעד' });
  });

  it('should return create new page where user ask explicit', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValueOnce({ content: 'existingContent', revid: 456 });
    api.articleContent.mockRejectedValueOnce(new Error('Not found'));
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = `==paragraph headline==
${statusTemplate}
paragraphContent
:@[[משתמש:Sapper-bot]] ארכב:תבנית:[[שיחת תבנית:ספרינגפילד]] ${userSign}`;
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary', 'Homer Simpson', ['יעדחדש', '[[שיחת תבנית:ספרינגפילד]]']);

    expect(result).toStrictEqual({ success: 'הארכוב בוצע בהצלחה' });

    expect(api.edit).toHaveBeenCalledWith(
      'archiveBoxContent',
      'summary',
      `existingContent\n==paragraph headline==
${statusTemplate}
{{הועבר|ל=שיחת תבנית:ספרינגפילד}} אורכב לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~`,
      456,
    );
    expect(api.create).toHaveBeenCalledWith(
      'שיחת תבנית:ספרינגפילד',
      'summary. הועבר מ[[pageTitle]]',
      `==paragraph headline==\n{{הועבר|מ=pageTitle}}\n${statusTemplate}\nparagraphContent\n\n{{סוף העברה}} אורכב לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~`,
    );

    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle',
      'summary. הועבר ל[[שיחת תבנית:ספרינגפילד]]',
      pageContent.replace(paragraphContent, ''),
      123,
    );
  });

  it('should archive template with status template when target is not link', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValueOnce({ content: 'existingContent', revid: 456 });
    api.articleContent.mockResolvedValueOnce({ content: 'targetContent', revid: 678 });
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = `==paragraph headline==
${statusTemplate}
paragraphContent
:@[[משתמש:Sapper-bot]] ארכב:תבנית:שיחת תבנית:ספרינגפילד ${userSign}`;
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary', 'Homer Simpson', ['יעד', 'שיחת תבנית:ספרינגפילד']);

    expect(result).toStrictEqual({ success: 'הארכוב בוצע בהצלחה' });

    expect(api.edit).toHaveBeenCalledWith(
      'archiveBoxContent',
      'summary',
      `existingContent\n==paragraph headline==
${statusTemplate}
{{הועבר|ל=שיחת תבנית:ספרינגפילד}} אורכב לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~`,
      456,
    );
    expect(api.edit).toHaveBeenCalledWith(
      'שיחת תבנית:ספרינגפילד',
      'summary. הועבר מ[[pageTitle]]',
      `targetContent\n==paragraph headline==\n{{הועבר|מ=pageTitle}}\n${statusTemplate}\nparagraphContent\n\n{{סוף העברה}} אורכב לבקשת [[משתמש:Homer Simpson]].{{כ}} ~~~~`,
      678,
    );

    expect(api.edit).toHaveBeenCalledWith(
      'pageTitle',
      'summary. הועבר ל[[שיחת תבנית:ספרינגפילד]]',
      pageContent.replace(paragraphContent, ''),
      123,
    );
  });

  it('should return error when there is wrong arguments', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValueOnce({ content: 'existingContent', revid: 456 });
    api.articleContent.mockResolvedValueOnce({ content: 'targetContent', revid: 678 });
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = `==paragraph headline==
${statusTemplate}
paragraphContent
:@[[משתמש:Sapper-bot]] ארכב:תבני:שיחת תבנית:ספרינגפילד ${userSign}`;
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary', 'Homer Simpson', ['תבני', 'שיחת תבנית:ספרינגפילד']);

    expect(result).toStrictEqual({ error: 'הועברו פרמטרים לא תקינים' });
  });
});
