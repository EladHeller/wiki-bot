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
      fakerTimers.setSystemTime(new Date('2020-01-01'));
      wikiApi.getArticleContent.mockResolvedValue('{{archiveBoxTemplate|\nparameter\n}}');
      archiveBotModel = ArchiveBotModel(wikiApi, {
        archiveTemplate: 'archiveTemplate',
        archiveBoxTemplate: 'archiveBoxTemplate',
        logParagraphTitlePrefix: 'logParagraphTitlePrefix',
        archiveTemplatePath: '/archiveTemplatePath',
        languageCode: 'en-US',
        monthArchivePath: (monthAndYear: string) => `monthArchivePath ${monthAndYear}`,
      });

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.getArticleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.getArticleContent).toHaveBeenCalledWith('logPage/archiveTemplatePath');
      expect(wikiApi.updateArticle).toHaveBeenCalledTimes(1);
      expect(wikiApi.updateArticle).toHaveBeenCalledWith(
        'logPage/archiveTemplatePath',
        'הוספת חודש נוכחי לתבנית ארכיון',
        '{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/monthArchivePath December 2019|December]]\n}}',
      );
    });

    it('should add month if not exists', async () => {
      fakerTimers.setSystemTime(new Date('2020-01-01'));
      wikiApi.getArticleContent.mockResolvedValue('{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n}}');
      archiveBotModel = ArchiveBotModel(wikiApi, {
        archiveTemplate: 'archiveTemplate',
        archiveBoxTemplate: 'archiveBoxTemplate',
        logParagraphTitlePrefix: 'logParagraphTitlePrefix',
        archiveTemplatePath: '/archiveTemplatePath',
        languageCode: 'en-US',
        monthArchivePath: (monthAndYear: string) => `monthArchivePath ${monthAndYear}`,
      });

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.getArticleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.getArticleContent).toHaveBeenCalledWith('logPage/archiveTemplatePath');
      expect(wikiApi.updateArticle).toHaveBeenCalledTimes(1);
      expect(wikiApi.updateArticle).toHaveBeenCalledWith(
        'logPage/archiveTemplatePath',
        'הוספת חודש נוכחי לתבנית ארכיון',
        '{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/monthArchivePath December 2019|December]]\n}}',
      );
    });

    it('should not update if month and year already exists', async () => {
      fakerTimers.setSystemTime(new Date('2020-01-01'));
      wikiApi.getArticleContent.mockResolvedValue('{{archiveBoxTemplate|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/monthArchivePath December 2019|December]]\n}}');
      archiveBotModel = ArchiveBotModel(wikiApi, {
        archiveTemplate: 'archiveTemplate',
        archiveBoxTemplate: 'archiveBoxTemplate',
        logParagraphTitlePrefix: 'logParagraphTitlePrefix',
        archiveTemplatePath: '/archiveTemplatePath',
        languageCode: 'en-US',
        monthArchivePath: (monthAndYear: string) => `monthArchivePath ${monthAndYear}`,
      });

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.getArticleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.getArticleContent).toHaveBeenCalledWith('logPage/archiveTemplatePath');
      expect(wikiApi.updateArticle).not.toHaveBeenCalled();
    });

    it('should use default config', async () => {
      fakerTimers.setSystemTime(new Date('2020-01-01'));
      wikiApi.getArticleContent.mockResolvedValue('{{תיבת ארכיון|\nparameter\n}}');
      archiveBotModel = ArchiveBotModel(wikiApi);

      await archiveBotModel.updateArchiveTemplate('logPage');

      expect(wikiApi.getArticleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.getArticleContent).toHaveBeenCalledWith('logPage/ארכיונים');
      expect(wikiApi.updateArticle).toHaveBeenCalledWith(
        'logPage/ארכיונים',
        'הוספת חודש נוכחי לתבנית ארכיון',
        '{{תיבת ארכיון|\nparameter\n* \'\'\'2019\'\'\'\n** [[logPage/ארכיון דצמבר 2019|דצמבר]]\n}}',
      );
    });

    it('should throw error if archive page content is missing', async () => {
      fakerTimers.setSystemTime(new Date('2020-01-01'));
      wikiApi.getArticleContent.mockResolvedValue(undefined);
      archiveBotModel = ArchiveBotModel(wikiApi);

      await expect(archiveBotModel.updateArchiveTemplate('logPage')).rejects.toThrow('Missing content for logPage/ארכיונים');
    });
  });

  describe('archiveContent', () => {
    it('should archive content', async () => {
      fakerTimers.setSystemTime(new Date('2020-03-04'));
      wikiApi.getArticleContent.mockResolvedValue(`text before\n==simple paragraph==\nsimple text\n[[user:123]]
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
שגשדג`);
      archiveBotModel = ArchiveBotModel(wikiApi);

      await archiveBotModel.archiveContent('logPage');

      expect(wikiApi.getArticleContent).toHaveBeenCalledTimes(1);
      expect(wikiApi.getArticleContent).toHaveBeenCalledWith('logPage');
      expect(wikiApi.updateArticle).toHaveBeenCalledTimes(2);
      expect(wikiApi.updateArticle).toHaveBeenNthCalledWith(1, 'logPage', 'ארכוב', `text before\n==simple paragraph==\nsimple text\n[[user:123]]
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
שגשדג`);
      expect(wikiApi.updateArticle).toHaveBeenNthCalledWith(2, 'logPage/ארכיון פברואר 2020', 'ארכוב', `{{ארכיון}}\n==לוג ריצה 1 בפברואר 2020==
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
  });
});
