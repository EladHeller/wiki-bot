import { IWikiApi } from '../../bot/wiki/NewWikiApi';
import { Mocked } from './types';

export default function WikiApiMock(base: Partial<Mocked<IWikiApi>> = {}) : Mocked<IWikiApi> {
  return {
    login: base.login ?? jest.fn(),
    request: base.request ?? jest.fn(),
    recursiveSubCategories: base.recursiveSubCategories ?? jest.fn(),
    backlinksTo: base.backlinksTo ?? jest.fn(),
    updateArticle: base.updateArticle ?? jest.fn(),
    getArticleContent: base.getArticleContent ?? jest.fn(),
    articleContent: base.articleContent ?? jest.fn(),
    externalUrl: base.externalUrl ?? jest.fn(),
    info: base.info ?? jest.fn(),
    purge: base.purge ?? jest.fn(),
    rollback: base.rollback ?? jest.fn(),
    undo: base.undo ?? jest.fn(),
    rollbackUserContributions: base.rollbackUserContributions ?? jest.fn(),
    categroyPages: base.categroyPages ?? jest.fn(),
    undoContributions: base.undoContributions ?? jest.fn(),
    protect: base.protect ?? jest.fn(),
    deletePage: base.deletePage ?? jest.fn(),
    getArticlesWithTemplate: base.getArticlesWithTemplate ?? jest.fn(),
    search: base.search ?? jest.fn(),
    getRedirects: base.getRedirects ?? jest.fn(),
    userContributes: base.userContributes ?? jest.fn(),
    listCategory: base.listCategory ?? jest.fn(),
    categoriesStartsWith: base.categoriesStartsWith ?? jest.fn(),
    fileUsage: base.fileUsage ?? jest.fn(),
    getWikiDataItem: base.getWikiDataItem ?? jest.fn(),
    newPages: base.newPages ?? jest.fn(),
    getArticleRevisions: base.getArticleRevisions ?? jest.fn(),
    logs: base.logs ?? jest.fn(),
    movePage: base.movePage ?? jest.fn(),
    edit: base.edit ?? jest.fn(),
  };
}
