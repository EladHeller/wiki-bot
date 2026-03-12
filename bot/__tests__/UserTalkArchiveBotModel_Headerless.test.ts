import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import { IUserTalkArchiveBotModel } from '../maintenance/userTalkArchiveBot/UserTalkArchiveBotModel';
import { IWikiApi } from '../wiki/WikiApi';
import { Mocked } from '../../testConfig/mocks/types';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { logger } from '../utilities/logger';

// Mock getAllParagraphs before importing the model
jest.unstable_mockModule('../wiki/paragraphParser', () => ({
  getAllParagraphs: jest.fn(),
}));

// Dynamic import for the mocked module
const { getAllParagraphs } = await import('../wiki/paragraphParser');
const { default: UserTalkArchiveBotModel } = await import('../maintenance/userTalkArchiveBot/UserTalkArchiveBotModel');

describe('userTalkArchiveBotModel - Headerless Paragraphs', () => {
  let model: IUserTalkArchiveBotModel;
  let wikiApi: Mocked<IWikiApi>;

  beforeEach(() => {
    wikiApi = WikiApiMock();
    wikiApi.info.mockResolvedValue([{}]);
    wikiApi.articleContent.mockResolvedValue({ content: '', revid: 1 });
    jest.spyOn(logger, 'logWarning').mockImplementation(() => { });
    jest.spyOn(logger, 'logError').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return empty array when paragraph has no valid header (forcing extractYearAndWeekDate to return null early)', async () => {
    const pageContent = 'Headerless content';
    wikiApi.articleContent.mockResolvedValue({ content: pageContent, revid: 1 });

    // Mock getAllParagraphs to return a paragraph without a header
    (jest.mocked(getAllParagraphs)).mockReturnValue(['Headerless content']);

    model = UserTalkArchiveBotModel(wikiApi);

    const result = await model.getArchivableParagraphs('שיחת משתמש:דוגמה', 14);

    expect(result).toHaveLength(0);
    expect(getAllParagraphs).toHaveBeenCalledWith(pageContent, 'שיחת משתמש:דוגמה');
  });
});
