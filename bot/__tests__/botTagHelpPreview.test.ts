import {
  describe, expect, it, jest,
} from '@jest/globals';
import type OpenAI from 'openai';
import type { WikiNotification } from '../types';
import { describeConfiguredTiming, findRequestedStatus, fixedAnswers } from '../tag-bot/help/answers';
import answerKnownOperation from '../tag-bot/help/operationHelp';
import { createHelpClassifier, previewTagHelp } from '../tag-bot/help/preview';

const page = 'ויקיפדיה:קטגוריה/אולם דיונים';
const config = {
  page,
  statuses: ['טופל'],
  daysAfterLastActivity: 7,
  archiveType: 'תבנית ארכיון עם יעד' as const,
  archiveNavigatePage: page,
  targetedArchiveRegularArchiveMode: 'תבנית הועבר' as const,
  addNewState: true,
  updateInDiscussionState: true,
};
const readConfiguration = async () => [config];
type Mention = Parameters<typeof previewTagHelp>[0];

function mention(body: string, url = 'https://he.wikipedia.org/wiki/Example#comment'): Mention {
  return {
    type: 'mention',
    wiki: 'hewiki',
    title: { full: page } as WikiNotification['title'],
    '*': { body, links: { primary: { url } } } as WikiNotification['*'],
  };
}

describe('tag help preview', () => {
  it.each([
    mention('@Other-bot עזרה: שאלה'),
    mention('@Sapper-bot ענה: שאלה'),
    mention('@Sapper-bot עזרה: שאלה', 'https://he.wikipedia.org/wiki/Example'),
    { ...mention('@Sapper-bot עזרה: שאלה'), type: 'edit' },
    { ...mention('@Sapper-bot עזרה: שאלה'), wiki: 'enwiki' },
  ])('ignores notifications outside the pilot command', async (notification) => {
    const classify = jest.fn(async () => 'start' as const);

    await expect(previewTagHelp(notification, 'Sapper-bot', classify, readConfiguration)).resolves.toBeNull();
    expect(classify).not.toHaveBeenCalled();
  });

  it('asks what is needed when the question is empty', async () => {
    const classify = jest.fn(async () => 'start' as const);
    const result = await previewTagHelp(mention('@Sapper-bot עזרה: '), 'Sapper-bot', classify, readConfiguration);

    expect(result).toStrictEqual({ intent: 'unsupported', answer: fixedAnswers.unsupported });
    expect(classify).not.toHaveBeenCalled();
  });

  it('builds the template reference and copyable code from the same fixed answer', async () => {
    const classify = jest.fn(async () => 'exclude-section' as const);
    const read = jest.fn(readConfiguration);
    const notification = mention('@משתמש:Sapper-bot עזרה:  איך משאירים את הדיון?');
    const result = await previewTagHelp(notification, 'Sapper-bot', classify, read);

    expect(classify.mock.calls).toStrictEqual([['איך משאירים את הדיון?', page]]);
    expect(read).not.toHaveBeenCalled();
    expect(result?.answer).toContain('התבנית {{תב|לא לארכוב}}');
    expect(result?.answer).toContain('<code><nowiki>{{לא לארכוב}}</nowiki></code>');
  });

  it.each([
    'תארכב את הפסקה הזו עכשיו בבקשה',
    'אפשר לארכב את הדיון הזה עכשיו?',
    'איך מפעילים את בוט קישורי השפה?',
  ])('handles explicit out-of-scope requests before classifying (%s)', async (question) => {
    const classify = jest.fn(async () => 'start' as const);
    const result = await previewTagHelp(mention(`@Sapper-bot עזרה: ${question}`), 'Sapper-bot', classify, readConfiguration);

    expect(classify).not.toHaveBeenCalled();
    expect(result?.intent).toBe('unsupported');
  });

  it('keeps the two archive mechanisms separate even if the model misclassifies', async () => {
    const classify = async () => 'exclude-section' as const;
    const notification = mention('@Sapper-bot עזרה: איך מונעים מארכוב לפי מצב לארכב פסקה?');
    const result = await previewTagHelp(notification, 'Sapper-bot', classify, readConfiguration);

    expect(result?.intent).toBe('unsupported');
  });

  it('finds the most specific complete status and asks for a single status when needed', () => {
    const rules = [{ ...config, statuses: ['בוצע', 'לא בוצע', 'טופל', ''] }];

    expect(findRequestedStatus(rules, page, 'דיון שסומן ״לא בוצע״')).toBe('לא בוצע');
    expect(findRequestedStatus(rules, page, 'דיון שטופל')).toBe('טופל');
    expect(findRequestedStatus(rules, page, 'אם טופל או בוצע')).toBe('');
    expect(findRequestedStatus(rules, page, 'אם טופל, ואז שוב טופל')).toBe('טופל');
    expect(findRequestedStatus(rules, 'Other page', 'טופל')).toBe('');
  });

  it('uses the live row to explain timing and the archive target requirement', async () => {
    const classify = jest.fn(async () => 'status-date' as const);
    const notification = mention('@Sapper-bot עזרה: כמה ימים מחכים לדיון שסומן כטופל?');
    const result = await previewTagHelp(notification, 'Sapper-bot', classify, readConfiguration);

    expect(classify).not.toHaveBeenCalled();
    expect(result?.answer).toContain('7 ימי המתנה');
    expect(result?.answer).toContain('בלי ערך הדיון נשאר בדף');
    expect(result?.answer).toContain('צריך קישור לפסקה');
  });

  it('uses the model when a general timing question lacks a configured status', async () => {
    const classify = jest.fn(async () => 'page-timing' as const);
    const read = jest.fn(readConfiguration);
    const result = await previewTagHelp(mention('@Sapper-bot עזרה: כמה ימים מחכים לדיון שסומן בוצע?'), 'Sapper-bot', classify, read);

    expect(classify).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(result?.answer).toContain('צריך את הדף המדויק ואת הערך');
  });

  it.each([
    ['צריך לפתח בוט כדי לארכב רק דיונים שמכילים מילים מסוימות?', 'filter-text'],
    ['אפשר לפתח פעולה שתעדכן נתון מאתר העירייה?', 'new-task'],
  ])('handles clear archive or development questions directly (%s)', async (question, intent) => {
    const classify = jest.fn(async () => 'unsupported' as const);
    const result = await previewTagHelp(mention(`@Sapper-bot עזרה: ${question}`), 'Sapper-bot', classify, readConfiguration);

    expect(classify).not.toHaveBeenCalled();
    expect(result?.intent).toBe(intent);
  });

  it.each([
    'אפשר לארכב רק דיונים חדשים?',
    'לארכב רק דיונים לפי מצב שמופיעה בהם מילה מסוימת?',
    'אפשר לשמור את דברי העריכה של אתר חדשות?',
    'איך לעדכן הגדרה באתר?',
  ])('does not route partial phrase matches to a fixed answer (%s)', async (question) => {
    const classify = jest.fn(async () => 'unsupported' as const);
    const result = await previewTagHelp(mention(`@Sapper-bot עזרה: ${question}`), 'Sapper-bot', classify, readConfiguration);

    expect(classify).toHaveBeenCalledTimes(1);
    expect(result?.intent).toBe('unsupported');
  });

  it('asks for the status when it was never stated', async () => {
    const classify = async () => 'page-timing' as const;
    const result = await previewTagHelp(mention('@Sapper-bot עזרה: כמה זמן?'), 'Sapper-bot', classify, readConfiguration);

    expect(result?.answer).toContain('צריך את הדף המדויק ואת הערך');
  });

  it('does not guess a wait for duplicate status rules', () => {
    const answer = describeConfiguredTiming([config, { ...config, daysAfterLastActivity: 9 }], page, 'טופל');

    expect(answer).toContain('צריך את הדף המדויק ואת הערך');
  });

  it('mentions the target requirement only for the relevant archive type', () => {
    const answer = describeConfiguredTiming([{ ...config, archiveType: 'רבעון' }], page, 'טופל');

    expect(answer).toContain('7 ימי המתנה');
    expect(answer).not.toContain('בלי ערך הדיון נשאר בדף');
  });

  it('ignores rules for a different page', () => {
    expect(describeConfiguredTiming([config], 'Other page', 'טופל')).not.toContain('7');
  });

  it.each([
    'מה קרה בריצה האחרונה של בוט הפרת זכויות יוצרים?',
    'זכויות יוצרים',
    'מי הכדורסלנים שזכו באליפות?',
  ])('does not use the operation overview for a different request (%s)', (question) => {
    expect(answerKnownOperation(question)).toBeNull();
  });

  it('requests structured classification from the chosen model', async () => {
    const create = jest.fn(async () => ({ status: 'completed', output_text: '{"intent":"start"}' }));
    const client = { responses: { create } } as unknown as OpenAI;
    const classify = createHelpClassifier(client, 'test-model');

    await expect(classify('שאלה', page)).resolves.toBe('start');
    expect(create.mock.calls).toStrictEqual([[expect.objectContaining({
      model: 'test-model', input: JSON.stringify({ question: 'שאלה', page }), store: false,
    })]]);
  });

  it.each([
    { status: 'incomplete', output_text: '{"intent":"start"}' },
    { status: 'completed', output_text: '' },
  ])('reports an unusable classification response', async (response) => {
    const client = { responses: { create: async () => response } } as unknown as OpenAI;
    const classify = createHelpClassifier(client, 'test-model');

    await expect(classify('שאלה', page)).rejects.toThrow('Incomplete help classification');
  });
});
