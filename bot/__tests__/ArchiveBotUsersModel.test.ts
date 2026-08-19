import {
  beforeEach, describe, expect, it,
} from '@jest/globals';
import ArchiveBotUsersModel, {
  IArchiveBotUsersModel,
  replaceHiddenUsers,
} from '../maintenance/archiveBotUsers/ArchiveBotUsersModel';
import { IWikiApi } from '../wiki/WikiApi';
import { WikiPage } from '../types';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';

function page(title: string): WikiPage {
  return { title } as WikiPage;
}

async function* pagesGenerator(batches: WikiPage[][]) {
  yield* batches;
}

describe('archiveBotUsersModel', () => {
  let wikiApi: Mocked<IWikiApi>;
  let model: IArchiveBotUsersModel;

  beforeEach(() => {
    wikiApi = WikiApiMock();
    model = ArchiveBotUsersModel(wikiApi);
  });

  describe('replaceHiddenUsers', () => {
    it('replaces only the hidden users span content', () => {
      const content = 'prefix<span class="users" style="color: red; display: none;">old</span><noinclude>docs</noinclude>';

      expect(replaceHiddenUsers(content, ['אלף', 'Beta'])).toBe(
        'prefix<span class="users" style="color: red; display: none;">[[משתמש:אלף]][[משתמש:Beta]]</span><noinclude>docs</noinclude>',
      );
    });

    it('throws when the hidden users span is missing', () => {
      expect(() => replaceHiddenUsers('content without hidden span', ['אלף']))
        .toThrow('Hidden archive bot users span not found');
    });
  });

  it('collects, deduplicates and sorts users from all archive bot templates', async () => {
    wikiApi.getArticlesWithTemplate
      .mockReturnValueOnce(pagesGenerator([
        [page('שיחת משתמש:צבי'), page('שיחת משתמש:אברהם/ארכיונים')],
        [page('שיחת משתמש:גד')],
      ]))
      .mockReturnValueOnce(pagesGenerator([[
        page('שיחת משתמש:אברהם'),
        page('שיחת משתמש:צבי/ארכיון 1'),
      ]]));
    const content = 'prefix<span style="display:none;">old</span><noinclude>docs</noinclude>';
    wikiApi.articleContent.mockResolvedValue({ content, revid: 12 });

    await model.update();

    expect(wikiApi.getArticlesWithTemplate).toHaveBeenNthCalledWith(
      1,
      'בוט ארכוב אוטומטי',
      undefined,
      'תבנית',
      '3',
    );
    expect(wikiApi.getArticlesWithTemplate).toHaveBeenNthCalledWith(
      2,
      'מחיקת הודעות תפוצה',
      undefined,
      'תבנית',
      '3',
    );
    expect(wikiApi.edit).toHaveBeenCalledWith(
      'תבנית:משתמשי בוט הארכוב',
      '[[ויקיפדיה:בוט/בוט ארכוב אוטומטי|בוט ארכוב אוטומטי]]: עדכון רשימת משתמשי הבוט',
      'prefix<span style="display:none;">[[משתמש:אברהם]][[משתמש:גד]][[משתמש:צבי]]</span><noinclude>docs</noinclude>',
      12,
      undefined,
      true,
    );
  });

  it('does not edit when the user list is unchanged', async () => {
    wikiApi.getArticlesWithTemplate
      .mockReturnValueOnce(pagesGenerator([[page('שיחת משתמש:אברהם')]]))
      .mockReturnValueOnce(pagesGenerator([]));
    const content = 'prefix<span style="display:none;">[[משתמש:אברהם]]</span><noinclude>docs</noinclude>';
    wikiApi.articleContent.mockResolvedValue({ content, revid: 12 });

    await model.update();

    expect(wikiApi.edit).not.toHaveBeenCalled();
  });

  it('does not clear the template when no users are found', async () => {
    wikiApi.getArticlesWithTemplate
      .mockReturnValueOnce(pagesGenerator([]))
      .mockReturnValueOnce(pagesGenerator([]));

    await expect(model.update()).rejects.toThrow('No archive bot users found');

    expect(wikiApi.articleContent).not.toHaveBeenCalled();
    expect(wikiApi.edit).not.toHaveBeenCalled();
  });
});
