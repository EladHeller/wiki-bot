import {
  beforeEach, describe, expect, it,
} from '@jest/globals';
import ArchiveBotModel, { defaultConfig, IArchiveBotModel } from '../maintenance/archiveBot/ArchiveBotModel';
import { IWikiApi } from '../wiki/WikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('archiveBotModel deleteContent', () => {
  let archiveBotModel: IArchiveBotModel;
  let wikiApi: Mocked<IWikiApi>;

  beforeEach(() => {
    wikiApi = WikiApiMock();
    archiveBotModel = ArchiveBotModel(wikiApi, {
      ...defaultConfig,
      archiveMonthDate: new Date('2020-02-01T00:00:00Z'),
    });
  });

  it('deletes sections whose titles are dated in the target month', async () => {
    wikiApi.articleContent.mockResolvedValue({
      content: `text before
== 31 בינואר 2020, 23:50 ==
ינואר
== 1 בפברואר 2020, 00:10 ==
פברואר ראשון
===פרטים===
טקסט נוסף
== 28 בפברואר 2020, 12:00 ==
פברואר אחרון
== 1 במרץ 2020, 00:01 ==
מרץ`,
      revid: 10,
    });

    await archiveBotModel.deleteContent('logPage', 'titleDate');

    expect(wikiApi.articleContent).toHaveBeenCalledWith('logPage');
    expect(wikiApi.edit).toHaveBeenCalledWith(
      'logPage',
      'מחיקת לוגים מחודש פברואר 2020',
      `text before
== 31 בינואר 2020, 23:50 ==
ינואר
== 1 במרץ 2020, 00:01 ==
מרץ`,
      10,
      undefined,
      true,
    );
    expect(wikiApi.create).not.toHaveBeenCalled();
    expect(wikiApi.info).not.toHaveBeenCalled();
  });

  it('does nothing when there are no sections from the target month', async () => {
    wikiApi.articleContent.mockResolvedValue({
      content: `== 31 בינואר 2020, 23:50 ==
ינואר
== 1 במרץ 2020, 00:01 ==
מרץ`,
      revid: 11,
    });

    await archiveBotModel.deleteContent('logPage', 'titleDate');

    expect(wikiApi.edit).not.toHaveBeenCalled();
    expect(wikiApi.create).not.toHaveBeenCalled();
  });
});
