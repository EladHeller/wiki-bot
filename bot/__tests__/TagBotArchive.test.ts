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
    const result = await archiveParagraph(api, 'pageContent', 123, 'pageTitle', 'paragraphContent', 'summary');

    expect(result).toStrictEqual({ error: 'תיבת ארכיון לא נמצאה' });
  });

  it('should return an error if the archive box content is not found', async () => {
    const archiveBox = '{{תיבת ארכיון}}';

    const result = await archiveParagraph(api, archiveBox, 123, 'pageTitle', 'paragraphContent', 'summary');

    expect(result).toStrictEqual({ error: 'התוכן של תיבת הארכיון לא נמצא' });
  });

  it('should return an error if no active archive page is found', async () => {
    api.info.mockResolvedValue([{ missing: '' }]);
    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';

    const result = await archiveParagraph(api, archiveBox, 123, 'pageTitle', 'paragraphContent', 'summary');

    expect(result).toStrictEqual({ error: 'לא נמצא דף ארכיון פעיל' });
  });

  it('should archive the paragraph successfully', async () => {
    api.info.mockResolvedValue([{ }]);
    api.articleContent.mockResolvedValue({ content: 'existingContent', revid: 456 });
    api.edit.mockResolvedValue({});

    const archiveBox = '{{תיבת ארכיון|תוכן=[[archiveBoxContent]]}}';
    const paragraphContent = 'paragraphContent';
    const pageContent = `${archiveBox}\n${paragraphContent}`;
    const result = await archiveParagraph(api, pageContent, 123, 'pageTitle', paragraphContent, 'summary');

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
    const result = await archiveParagraph(api, pageContent, 123, pageTitle, paragraphContent, 'summary');

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
    const result = await archiveParagraph(api, archiveBox, 123, 'pageTitle', 'paragraphContent', 'summary');

    expect(result).toStrictEqual({ error: 'ארעה שגיאה במהלך האירכוב' });
  });
});
