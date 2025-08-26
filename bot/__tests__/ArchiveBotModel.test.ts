import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import ArchiveBotModel, { defaultConfig, IArchiveBotModel } from '../maintenance/archiveBot/ArchiveBotModel';
import { IWikiApi } from '../wiki/WikiApi';
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

  describe('archiveContent (signatureDate mode)', () => {
    it('archives only paragraphs whose content contains a signature in the target month (he-IL, default config)', async () => {
      fakerTimers.setSystemTime(new Date('2020-03-02T00:00:00Z'));

      const pageContent = `
==A (no signature)==
אין חתימה כאן

==B (Feb 2020, with TZ)==
טקסט
12:42, 1 בפברואר 2020 (IDT)
עוד טקסט
==C (Jan 2020)==
משהו
09:00, 31 בינואר 2020 (IDT)

==D (Feb 2020, no TZ)==
עוד פסקה
23:59, 28 בפברואר 2020
טקסט סיום
==E (Mar 2020)==
תוכן
08:00, 1 במרץ 2020 (IDT)
`;

      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 10 });

      archiveBotModel = ArchiveBotModel(wikiApi);

      await archiveBotModel.archiveContent('logPage', 'signatureDate');

      expect(wikiApi.create).toHaveBeenCalledTimes(1);
      expect(wikiApi.create).toHaveBeenCalledWith(
        'logPage/ארכיון פברואר 2020',
        'ארכוב פברואר 2020',
        `{{ארכיון}}\n==B (Feb 2020, with TZ)==
טקסט
12:42, 1 בפברואר 2020 (IDT)
עוד טקסט
==D (Feb 2020, no TZ)==
עוד פסקה
23:59, 28 בפברואר 2020
טקסט סיום
`,
      );

      // It should edit the source page, removing B and D, leaving A, C, E intact.
      expect(wikiApi.edit).toHaveBeenCalledTimes(1);

      expect(wikiApi.edit).toHaveBeenCalledWith(
        'logPage',
        'ארכוב פברואר 2020',
        `
==A (no signature)==
אין חתימה כאן

==C (Jan 2020)==
משהו
09:00, 31 בינואר 2020 (IDT)

==E (Mar 2020)==
תוכן
08:00, 1 במרץ 2020 (IDT)
`,
        10,
      );
    });

    it('does nothing when no paragraph contains a signature for the target month', async () => {
      fakerTimers.setSystemTime(new Date('2020-03-02T00:00:00Z')); // target month: Feb 2020

      const pageContent = `
==Only January==
12:00, 31 בינואר 2020 (IDT)

==Only March==
12:00, 1 במרץ 2020 (IDT)

==No signature==
פסקה בלי חתימה
`;
      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 11 });

      archiveBotModel = ArchiveBotModel(wikiApi);

      await archiveBotModel.archiveContent('logPage', 'signatureDate');

      expect(wikiApi.create).not.toHaveBeenCalled();
      expect(wikiApi.edit).not.toHaveBeenCalled();
    });

    it('respects explicit archiveMonthDate (e.g., יולי 2025)', async () => {
      const archiveMonthDate = new Date('2025-07-01T00:00:00Z');

      const pageContent = `


==July match==
משהו
05:55, 30 ביולי 2025 (IDT)
סוף
==August not match==
01:00, 1 באוגוסט 2025 (IDT)
`;
      wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 12 });

      archiveBotModel = ArchiveBotModel(wikiApi, {
        ...defaultConfig,
        archiveMonthDate,
      });

      await archiveBotModel.archiveContent('logPage', 'signatureDate');

      expect(wikiApi.create).toHaveBeenCalledWith(
        'logPage/ארכיון יולי 2025',
        'ארכוב יולי 2025',
        `{{ארכיון}}\n==July match==
משהו
05:55, 30 ביולי 2025 (IDT)
סוף
`,
      );
      expect(wikiApi.edit).toHaveBeenCalledWith(
        'logPage',
        'ארכוב יולי 2025',
        `

==August not match==
01:00, 1 באוגוסט 2025 (IDT)
`,
        12,
      );
    });
  });
});
