import { jest } from '@jest/globals';
import { IWikiApi } from '../../bot/wiki/NewWikiApi';
import { Mocked } from './types';
import {
  LogEvent, Revision, UserContribution, WikiPage,
} from '../../bot/types';

export default function WikiApiMock(base: Partial<Mocked<IWikiApi>> = {}) : Mocked<IWikiApi> {
  return {
    login: base.login ?? jest.fn<() => Promise<void>>(),
    request: base.request ?? jest.fn<(path: string, method?: string, data?: Record<string, any>) => Promise<any>>(),
    continueQuery:
    base.continueQuery ?? jest.fn<(path: string,
        resultConverterCallback?: (result: any) => any,
        baseContinue?: Record<string, any>
      ) => AsyncGenerator<any, any, unknown>
    >(),
    recursiveSubCategories: base.recursiveSubCategories
      ?? jest.fn<(category: string, limit?: number) => AsyncGenerator<WikiPage, WikiPage, void>>(),
    backlinksTo:
      base.backlinksTo
      ?? jest.fn<(target: string, namespace?: string) => AsyncGenerator<WikiPage[], void, void>>(),
    updateArticle:
      base.updateArticle
      ?? jest.fn<(articleTitle: string, summary: string, content: string, newSectionTitle?: string) => Promise<any>>(),
    articleContent:
      base.articleContent
      ?? jest.fn<(title: string) => Promise<any>>(),
    externalUrl:
      base.externalUrl
      ?? jest.fn<(link: string, protocol?: string, namespace?: string) => AsyncGenerator<WikiPage[], void, void>>(),
    info: base.info ?? jest.fn<(titles: string[]) => Promise<Partial<WikiPage>[]>>(),
    purge: base.purge ?? jest.fn<(titles: string[]) => Promise<any>>(),
    rollback: base.rollback ?? jest.fn<(title: string, user: string, summary: string) => Promise<any>>(),
    undo:
      base.undo
      ?? jest.fn<(title: string, summary: string, revision: number) => Promise<any>>(),
    rollbackUserContributions:
      base.rollbackUserContributions
      ?? jest.fn<(user: string, summary: string, count?: number) => Promise<any>>(),
    categroyPages:
      base.categroyPages
      ?? jest.fn<(category: string, limit?: number) => AsyncGenerator<WikiPage[], void, void>>(),
    undoContributions:
      base.undoContributions
      ?? jest.fn<(title: string, user: string) => Promise<any>>(),
    protect:
      base.protect
      ?? jest.fn<(title: string, protections: string, expiry: string, reason: string) => Promise<any>>(),
    deletePage:
      base.deletePage
      ?? jest.fn<(title: string, reason: string) => Promise<any>>(),
    getArticlesWithTemplate:
      base.getArticlesWithTemplate
      ?? jest.fn<(templateName: string,
         continueObject?: Record<string, string>, prefix?: string, namespace?: string
        ) => AsyncGenerator<WikiPage[], void, void>>(),
    search:
      base.search
      ?? jest.fn<(text: string) => AsyncGenerator<WikiPage[], void, void>>(),
    getRedirects:
      base.getRedirects
      ?? jest.fn<(namespace?: number, linkNamespace?: number[], limit?: number,
        templates?: string, categories?: string) => AsyncGenerator<WikiPage[], void, void>>(),
    userContributes:
      base.userContributes
      ?? jest.fn<(user: string, limit?: number) => AsyncGenerator<UserContribution[], void, void>>(),
    listCategory: base.listCategory ?? jest.fn<(category: string, limit?: number, type?: string
    ) => AsyncGenerator<WikiPage[], void, void>>(),
    categoriesStartsWith:
      base.categoriesStartsWith
      ?? jest.fn<(prefix: string) => AsyncGenerator<WikiPage[], void, void>>(),
    fileUsage:
      base.fileUsage
      ?? jest.fn<(pageIds: string[], limit?: number) => AsyncGenerator<WikiPage[], void, void>>(),
    getWikiDataItem:
      base.getWikiDataItem
      ?? jest.fn<(title: string) => Promise<string | undefined>>(),
    newPages:
      base.newPages
      ?? jest.fn<(namespaces: number[], endTimestamp: string, limit?: number) =>
        AsyncGenerator<WikiPage[], void, void>>(),
    getArticleRevisions:
      base.getArticleRevisions
      ?? jest.fn<(title: string, limit: number) => Promise<Revision[]>>(),
    logs:
      base.logs
      ?? jest.fn<(type: string, namespaces: number[], endTimestamp: string, limit?: number) =>
        AsyncGenerator<LogEvent[], void, void>>(),
    movePage:
      base.movePage
      ?? jest.fn<(from: string, to: string, reason: string) => Promise<void>>(),
    edit:
      base.edit
      ?? jest.fn<(articleTitle: string,
        summary: string,
        content: string,
        baseRevId: number,
        newSectionTitle?: string
      ) => Promise<any>>(),
    create:
      base.create
      ?? jest.fn<(articleTitle: string, summary: string, content: string) => Promise<any>>(),
    categroyTitles:
      base.categroyTitles
      ?? jest.fn<(category: string, limit?: number) => AsyncGenerator<WikiPage[], void, void>>(),
    getRedirecTarget: base.getRedirecTarget ?? jest.fn<(title: string) => Promise<WikiPage | null>>(),
  };
}
