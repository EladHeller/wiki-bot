import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import ArchiveBotModel, { IArchiveBotModel } from '../maintenance/archiveBot/ArchiveBotModel';
import { IWikiApi } from '../wiki/NewWikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

describe('archiveBotModel', () => {
  let archiveBotModel: IArchiveBotModel;
  let wikiApi: Mocked<IWikiApi>;
  const fakerTimers = jest.useFakeTimers();

  beforeEach(() => {
    wikiApi = WikiApiMock();
  });

  afterEach(() => {
    jest.setSystemTime(jest.getRealSystemTime());
  });

  describe('updateArchiveTemplate', () => {
    it('should add month and year if not exists at all', async () => {
      wikiApi.articleContent.mockResolvedValue({ content: '{{archiveBoxTemplate|\nparameter\n}}', revid: 1 });
      archiveBotModel = ArchiveBotModel(wikiApi, {
        archiveTemplate: 'archiveTemplate',
        archiveBoxTemplate: 'archiveBoxTemplate',
        logParagraphTitlePrefix: 'logParagraphTitlePrefix',
        archiveTemplatePath: '/archiveTemplatePath',
        languageCode: 'en-US',
        monthArchivePath: (monthAndYear: string) => `monthArchivePath ${monthAndYear}`,
        archiveMonthDate: new Date('2019-12-01'),
      });

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.articleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.articleContent).toHaveBeenCalledWith('logPage/archiveTemplatePath');
      expect(wikiApi.edit).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'logPage/archiveTemplatePath',
        'הוספת חודש נוכחי לתבנית ארכיון',
        '{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/monthArchivePath December 2019|December]]\n}}',
        1,
      );
    });

    it('should add month if not exists', async () => {
      wikiApi.articleContent.mockResolvedValue({ content: '{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n}}', revid: 1 });
      archiveBotModel = ArchiveBotModel(wikiApi, {
        archiveTemplate: 'archiveTemplate',
        archiveBoxTemplate: 'archiveBoxTemplate',
        logParagraphTitlePrefix: 'logParagraphTitlePrefix',
        archiveTemplatePath: '/archiveTemplatePath',
        languageCode: 'en-US',
        monthArchivePath: (monthAndYear: string) => `monthArchivePath ${monthAndYear}`,
        archiveMonthDate: new Date('2019-12-01'),
      });

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.articleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.articleContent).toHaveBeenCalledWith('logPage/archiveTemplatePath');
      expect(wikiApi.edit).toHaveBeenCalledTimes(1);
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'logPage/archiveTemplatePath',
        'הוספת חודש נוכחי לתבנית ארכיון',
        '{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/monthArchivePath December 2019|December]]\n}}',
        1,
      );
    });

    it('should not update if month and year already exists', async () => {
      wikiApi.articleContent.mockResolvedValue(
        { content: '{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/monthArchivePath December 2019|December]]\n}}', revid: 1 },
      );
      archiveBotModel = ArchiveBotModel(wikiApi, {
        archiveTemplate: 'archiveTemplate',
        archiveBoxTemplate: 'archiveBoxTemplate',
        logParagraphTitlePrefix: 'logParagraphTitlePrefix',
        archiveTemplatePath: '/archiveTemplatePath',
        languageCode: 'en-US',
        monthArchivePath: (monthAndYear: string) => `monthArchivePath ${monthAndYear}`,
        archiveMonthDate: new Date('2019-12-01'),
      });

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.articleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.articleContent).toHaveBeenCalledWith('logPage/archiveTemplatePath');
      expect(wikiApi.edit).not.toHaveBeenCalled();
    });

    it('should use default config', async () => {
      fakerTimers.setSystemTime(new Date('2020-01-02'));
      wikiApi.articleContent.mockResolvedValue({ content: '{{תיבת ארכיון|\nparameter\n}}', revid: 1 });
      archiveBotModel = ArchiveBotModel(wikiApi);

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.articleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.articleContent).toHaveBeenCalledWith('logPage/ארכיונים');
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'logPage/ארכיונים',
        'הוספת חודש נוכחי לתבנית ארכיון',
        '{{תיבת ארכיון|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/ארכיון דצמבר 2019|דצמבר]]\n}}',
        1,
      );
    });

    it('should throw error if archive page content is missing', async () => {
      wikiApi.articleContent.mockResolvedValue({ content: '', revid: 1 });
      archiveBotModel = ArchiveBotModel(wikiApi);

      await expect(archiveBotModel.updateArchiveTemplate('logPage')).rejects.toThrow('Missing content for logPage/ארכיונים');
    });
  });

  describe('archiveContent', () => {
    it('should archive content', async () => {
      fakerTimers.setSystemTime(new Date('2020-03-02'));
      wikiApi.articleContent.mockResolvedValue({
        content: `text before
==simple paragraph==
simple text
[[user:123]]
==לוג ריצה 1 בפברואר 2019==
שדגחשדגםחשדגםח
שדגשגדשדג
==לוג ריצה 1 בינואר 2020==
שגשדגדג
שגשגשגד
==לוג ריצה 28 בינואר 2020==
בלשחשדלחדש
===ריצת ערב===
שדגשדגשדג
==לוג ריצה 1 בפברואר 2020==
שדגשדגעלךלףצףם
םןכחפן חשפכדגכפםדגלכ
דךכגחלדגכךל
===ריצת ערב===
כשכגכדג
שגכגדכדגכ
==לוג ריצה 28 בפברואר 2020==
שדגשדלח שדג
שגשגשדגשדג
שדג
==לוג ריצה 1 במרץ 2020==
adfaljnl allk nalsdfkn 
asdad asd
ad
adasd
==לוג ריצה 4 במרץ 2020==
ששדגשגשדג
שגשדג`,
        revid: 1,
      });
      archiveBotModel = ArchiveBotModel(wikiApi);

      await archiveBotModel.archiveContent('logPage');

      expect(wikiApi.articleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.articleContent).toHaveBeenCalledWith('logPage');
      expect(wikiApi.edit).toHaveBeenCalledWith('logPage', 'ארכוב פברואר 2020', `text before
==simple paragraph==
simple text
[[user:123]]
==לוג ריצה 1 בפברואר 2019==
שדגחשדגםחשדגםח
שדגשגדשדג
==לוג ריצה 1 בינואר 2020==
שגשדגדג
שגשגשגד
==לוג ריצה 28 בינואר 2020==
בלשחשדלחדש
===ריצת ערב===
שדגשדגשדג

==לוג ריצה 1 במרץ 2020==
adfaljnl allk nalsdfkn 
asdad asd
ad
adasd
==לוג ריצה 4 במרץ 2020==
ששדגשגשדג
שגשדג`, 1);
      expect(wikiApi.create).toHaveBeenCalledWith('logPage/ארכיון פברואר 2020', 'ארכוב פברואר 2020', `{{ארכיון}}\n==לוג ריצה 1 בפברואר 2020==
שדגשדגעלךלףצףם
םןכחפן חשפכדגכפםדגלכ
דךכגחלדגכךל
===ריצת ערב===
כשכגכדג
שגכגדכדגכ
==לוג ריצה 28 בפברואר 2020==
שדגשדלח שדג
שגשגשדגשדג
שדג\n`);
    });

    it('should not archive if no content to archive', async () => {
      wikiApi.articleContent.mockResolvedValue({ content: 'text before', revid: 1 });
      archiveBotModel = ArchiveBotModel(wikiApi);

      await archiveBotModel.archiveContent('logPage');

      expect(wikiApi.articleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.articleContent).toHaveBeenCalledWith('logPage');
      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
    });
  });
});
