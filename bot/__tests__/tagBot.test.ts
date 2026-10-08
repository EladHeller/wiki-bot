import {
  beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import WikiApiMock from '../../testConfig/mocks/wikiApi.mock';
import { WikiNotification } from '../types';
import { getLocalTimeAndDate } from '../utilities';

const api = WikiApiMock();
const archiveMock = jest.fn<(...args: unknown[]) => Promise<{ success: string } | { error: string }>>();
const moveMock = jest.fn<(...args: unknown[]) => Promise<{ success: string } | { error: string }>>();
const askMock = jest.fn<(question: string) => Promise<string>>();
const checkMock = jest.fn<(...args: unknown[]) => Promise<string>>();
const logErrorMock = jest.fn();

jest.unstable_mockModule('../wiki/WikiApi', () => ({ default: () => api }));
jest.unstable_mockModule('../tag-bot/actions/archive', () => ({ default: archiveMock, moveTo: moveMock }));
jest.unstable_mockModule('../tag-bot/gpt-bot/askGPT', () => ({ default: askMock }));
jest.unstable_mockModule('../tag-bot/actions/checkPage', () => ({ checkExternalLinks: checkMock }));
jest.unstable_mockModule('../utilities/logger', () => ({ logger: { logError: logErrorMock } }));
jest.unstable_mockModule('../decorators/botLoggerDecorator', () => ({ default: (cb: unknown) => cb }));

const { default: tagBot } = await import('../tag-bot/index');
const timestamp = '2026-10-08T10:00:00Z';
const tagPage = 'משתמש:Test-bot/בוט התיוג';
const emailsPage = 'user:Test-bot/אימיילים';
const config = '==רשימת משתמשים==\n[[משתמש:Requester]]';

function notification(body: string): WikiNotification {
  return {
    type: 'mention',
    wiki: 'hewiki',
    agent: { id: 1, name: 'Requester' },
    title: { full: 'שיחה:מקור' },
    timestamp: { utciso8601: timestamp },
    '*': {
      body,
      header: 'Mention',
      links: { primary: { url: 'https://he.wikipedia.org/wiki/Talk:Source#comment', label: 'Comment' } },
    },
  } as WikiNotification;
}

function paragraph(command: string) {
  return `== Topic ==\nDiscussion\n:הדיון הסתיים. @[[משתמש:Test-bot]] ${command} [[משתמש:Requester]] ${getLocalTimeAndDate(timestamp)}`;
}

async function run(body: string, overrides: Partial<WikiNotification> = {}) {
  const item = { ...notification(body), ...overrides };
  api.getNotifications.mockResolvedValue({ query: { notifications: { list: [item] } } });
  await tagBot();
}

describe('tagBot', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    api.articleContent.mockResolvedValue({ content: 'Page content', revid: 2 });
    api.articleContent.mockResolvedValueOnce({ content: config, revid: 1 });
    api.info.mockResolvedValue([{ lastrevid: 3 }]);
    api.getUserGroups.mockResolvedValue([]);
    archiveMock.mockResolvedValue({ success: 'Archived' });
    moveMock.mockResolvedValue({ success: 'Moved' });
    askMock.mockResolvedValue('Answer');
    checkMock.mockResolvedValue('Checked');
  });

  it.each([
    '@Test-bot ענה: Question: https://example.com',
    'רקע: טקסט מקדים. @Test-bot ענה: Question: https://example.com',
    'רקע\n@Test-bot ענה: Question: https://example.com',
    'רקע: @user:Test-bot ענה: Question: https://example.com',
    'רקע: @משתמש:Test-bot ענה: Question: https://example.com',
    '(@test-BOT ענה: Question: https://example.com',
    '@Test-bot תודה. בהמשך: @Test-bot ענה: Question: https://example.com',
  ])('should execute an adjacent command in %s', async (body) => {
    await run(body);

    expect(askMock).toHaveBeenCalledWith('Question: https://example.com');
    expect(api.getUserGroups).not.toHaveBeenCalled();
    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), '@[[משתמש:Requester|Requester]] \nAnswer.', 'comment');
    expect(api.markRead).toHaveBeenCalledTimes(1);
    expect(api.edit).toHaveBeenCalledWith(emailsPage, 'Mention', expect.any(String), 3, 'Mention');
  });

  it.each([
    '@Test-bot תודה על הבדיקה',
    'רקע: @Test-bot תודה על הבדיקה',
    '@Test-bot לידיעתך: טקסט',
    '@Test-bot לא נתמך: טקסט',
    '@Test-bot יכול לעזור. בדוק: דף',
    'בדוק: דף @Test-bot',
    '@Test-bot בדוק דף',
    '@Test-bot בדוקשוב: דף',
    '@Test-bot-other בדוק: דף',
    '@Test-botבדוק: דף',
    'name@Test-bot בדוק: דף',
    'שם@Test-bot בדוק: דף',
    '@@Test-bot בדוק: דף',
    '@Other-bot בדוק: דף',
    'Test-bot בדוק: דף',
  ])('should silently ignore %s before checking permissions', async (body) => {
    await run(body, { agent: { id: 2, name: 'Unapproved' } });

    expect(api.getUserGroups).not.toHaveBeenCalled();
    expect(api.addComment).not.toHaveBeenCalled();

    const actionCalls = [askMock, checkMock, archiveMock, moveMock].map((action) => action.mock.calls);

    expect(actionCalls).toStrictEqual([[], [], [], []]);
  });

  it.each([
    { type: 'edit' },
    { wiki: 'enwiki' },
  ])('should ignore unrelated notifications: %j', async (overrides) => {
    await run('@Test-bot ענה: Question', overrides);

    expect(askMock).not.toHaveBeenCalled();
    expect(api.addComment).not.toHaveBeenCalled();
  });

  it('should ignore notifications without a comment anchor', async () => {
    const item = notification('@Test-bot ענה: Question');
    item['*'].links.primary.url = 'https://he.wikipedia.org/wiki/Source';
    await run('', item);

    expect(askMock).not.toHaveBeenCalled();
  });

  it('should permit users in an allowed group without a configured user list', async () => {
    api.articleContent.mockReset().mockResolvedValue({ content: '', revid: 1 });
    api.getUserGroups.mockResolvedValue(['user', 'autopatrolled']);
    await run('רקע: @Test-bot ענה: Question');

    expect(api.getUserGroups).toHaveBeenCalledWith('Requester');
    expect(askMock).toHaveBeenCalledWith('Question');
  });

  it('should reject an explicit command from an unapproved user', async () => {
    await run('רקע: @Test-bot ענה: Question', { agent: { id: 2, name: 'Unapproved' } });

    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), expect.stringContaining('אינך מורשה'), 'comment');
    expect(askMock).not.toHaveBeenCalled();
  });

  it('should retain namespaces in page arguments and follow redirects', async () => {
    api.articleContent.mockResolvedValueOnce({ content: '#הפניה [[ויקיפדיה:יעד]]', revid: 2 });
    await run('רקע: @משתמש:Test-bot בדוק: ויקיפדיה:מזנון');

    expect(api.articleContent.mock.calls.map(([title]) => title)).toStrictEqual([tagPage, 'ויקיפדיה:מזנון', 'ויקיפדיה:יעד']);
    expect(checkMock).toHaveBeenCalledWith('Page content', expect.objectContaining({ title: 'שיחה:מקור', commentId: 'comment' }));
    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), expect.stringContaining('Checked'), 'comment');
  });

  it('should report a missing check target', async () => {
    await run('רקע: @Test-bot בדוק: ');

    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), expect.stringContaining('לא נמצא קישור לדף'), 'comment');
    expect(checkMock).not.toHaveBeenCalled();
  });

  it('should report an unavailable check target', async () => {
    api.articleContent.mockRejectedValueOnce(new Error('Missing page'));
    await run('רקע: @Test-bot בדוק: דף');

    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), expect.stringContaining('אירעה שגיאה בהבאת תוכן הדף דף'), 'comment');
    expect(checkMock).not.toHaveBeenCalled();
  });

  it.each([
    ['ארכב:', [null, '']],
    ['ארכב ל: שיחה:יעד', ['ל', 'שיחה:יעד']],
    ['ארכב: יעד: שיחה:יעד', ['ל', 'שיחה:יעד']],
    ['ארכב: יעד:   ', [null, '']],
  ])('should extract only the selected archive command %s', async (command, target) => {
    const content = paragraph(command as string);
    api.articleContent.mockResolvedValueOnce({ content, revid: 2 });
    await run(`רקע: ארכב ל: שיחה:לא היעד. @Test-bot ${command}`);

    expect(archiveMock).toHaveBeenCalledWith(api, content, 2, 'שיחה:מקור', content, expect.any(String), 'Requester', target);
  });

  it('should extract only the selected move target', async () => {
    const content = paragraph('העבר: שיחה:יעד');
    api.articleContent.mockResolvedValueOnce({ content, revid: 2 });
    await run('רקע: העבר: שיחה:לא היעד. @Test-bot העבר: שיחה:יעד');

    expect(moveMock).toHaveBeenCalledWith(api, 'Requester', content, content, 2, 'שיחה:מקור', expect.any(String), 'שיחה:יעד');
  });

  it('should report a missing move target', async () => {
    api.articleContent.mockResolvedValueOnce({ content: paragraph('העבר:'), revid: 2 });
    await run('רקע: @Test-bot העבר: ');

    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), expect.stringContaining('לא נמצא יעד להעברה'), 'comment');
    expect(moveMock).not.toHaveBeenCalled();
  });

  it.each(['ארכב:', 'העבר: יעד'])('should report a missing paragraph for %s', async (command) => {
    api.articleContent.mockResolvedValueOnce({
      content: [
        paragraph(command).replace('@[[משתמש:Test-bot]]', 'No mention'),
        paragraph('No command'),
        paragraph(command).replace('Requester', 'SomeoneElse'),
        paragraph(command).replace(getLocalTimeAndDate(timestamp), 'Old timestamp'),
      ].join('\n'),
      revid: 2,
    });
    await run(`רקע: @Test-bot ${command}`);

    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), expect.stringContaining('לא נמצאה פסקה מתאימה'), 'comment');
    expect(archiveMock).not.toHaveBeenCalled();
    expect(moveMock).not.toHaveBeenCalled();
  });

  it.each(['ארכב:', 'העבר: יעד'])('should report action errors for %s', async (command) => {
    api.articleContent.mockResolvedValueOnce({ content: paragraph(command), revid: 2 });
    archiveMock.mockResolvedValue({ error: 'Failure' });
    moveMock.mockResolvedValue({ error: 'Failure' });
    await run(`רקע: @Test-bot ${command}`);

    expect(api.addComment).toHaveBeenCalledWith('שיחה:מקור', expect.any(String), expect.stringContaining('Failure'), 'comment');
  });

  it.each([new Error('Failure'), { data: 'Failure' }, 'Failure'])('should handle failures: %j', async (error) => {
    api.getUserGroups.mockResolvedValue(['sysop']);
    api.articleContent.mockRejectedValueOnce(error);
    await run('@Test-bot ארכב:');
    askMock.mockRejectedValueOnce(error);
    await run('@Test-bot ענה: Question');
    checkMock.mockRejectedValueOnce(error);
    await run('@Test-bot בדוק: דף');
    api.info.mockRejectedValueOnce(error);
    await run('Plain mention');

    expect(logErrorMock).toHaveBeenCalledWith('Failure');
    expect(logErrorMock).toHaveBeenCalledWith('Failed to ask gpt: Failure');
    expect(logErrorMock).toHaveBeenCalledWith('Failed to check page: Failure');
    expect(logErrorMock).toHaveBeenCalledWith('Failed to save notification: Failure');
    expect(api.addComment).toHaveBeenCalledTimes(3);
  });

  it.each([{ info: [] }, { info: [{}] }])('should handle missing notification log revisions: %j', async ({ info }) => {
    api.info.mockResolvedValue(info);
    await run('Plain mention');

    expect(logErrorMock).toHaveBeenCalledWith(`Failed to save notification: No revid for ${emailsPage}`);
    expect(api.edit).not.toHaveBeenCalled();
  });
});
