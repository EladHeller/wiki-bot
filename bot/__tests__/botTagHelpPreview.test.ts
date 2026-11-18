import {
  describe, expect, it, jest,
} from '@jest/globals';
import type OpenAI from 'openai';
import type { WikiNotification } from '../types';
import { describeConfiguredTiming, fixedAnswers } from '../tag-bot/help/answers';
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
    const classify = jest.fn(async () => ({ intent: 'start' as const, status: '' }));

    await expect(previewTagHelp(notification, 'Sapper-bot', classify, readConfiguration)).resolves.toBeNull();
    expect(classify).not.toHaveBeenCalled();
  });

  it('asks what is needed when the question is empty', async () => {
    const classify = jest.fn(async () => ({ intent: 'start' as const, status: '' }));
    const result = await previewTagHelp(mention('@Sapper-bot עזרה: '), 'Sapper-bot', classify, readConfiguration);

    expect(result).toStrictEqual({ intent: 'unsupported', answer: fixedAnswers.unsupported });
    expect(classify).not.toHaveBeenCalled();
  });

  it('builds the template reference and copyable code from the same fixed answer', async () => {
    const classify = jest.fn(async () => ({ intent: 'exclude-section' as const, status: '' }));
    const read = jest.fn(readConfiguration);
    const notification = mention('@משתמש:Sapper-bot עזרה:  איך משאירים את הדיון?');
    const result = await previewTagHelp(notification, 'Sapper-bot', classify, read);

    expect(classify.mock.calls).toStrictEqual([['איך משאירים את הדיון?', page]]);
    expect(read).not.toHaveBeenCalled();
    expect(result?.answer).toContain('התבנית {{תב|לא לארכוב}}');
    expect(result?.answer).toContain('<code><nowiki>{{לא לארכוב}}</nowiki></code>');
  });

  it('uses the live row to explain timing and the archive target requirement', async () => {
    const classify = async () => ({ intent: 'page-timing' as const, status: 'טופל' });
    const notification = mention('@Sapper-bot עזרה: כמה ימים מחכים לדיון שסומן טופל?');
    const result = await previewTagHelp(notification, 'Sapper-bot', classify, readConfiguration);

    expect(result?.answer).toContain('7 ימי המתנה');
    expect(result?.answer).toContain('בלי ערך הדיון נשאר בדף');
    expect(result?.answer).toContain('צריך קישור לפסקה');
  });

  it.each(['', 'לא נטען בשאלה'])('asks for the status when it was never stated (%s)', async (status) => {
    const classify = async () => ({ intent: 'page-timing' as const, status });
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

  it('requests structured classification from the chosen model', async () => {
    const create = jest.fn(async () => ({ status: 'completed', output_text: '{"intent":"start","status":""}' }));
    const client = { responses: { create } } as unknown as OpenAI;
    const classify = createHelpClassifier(client, 'test-model');

    await expect(classify('שאלה', page)).resolves.toStrictEqual({ intent: 'start', status: '' });
    expect(create.mock.calls).toStrictEqual([[expect.objectContaining({
      model: 'test-model', input: JSON.stringify({ question: 'שאלה', page }), store: false,
    })]]);
  });

  it.each([
    { status: 'incomplete', output_text: '{"intent":"start","status":""}' },
    { status: 'completed', output_text: '' },
  ])('reports an unusable classification response', async (response) => {
    const client = { responses: { create: async () => response } } as unknown as OpenAI;
    const classify = createHelpClassifier(client, 'test-model');

    await expect(classify('שאלה', page)).rejects.toThrow('Incomplete help classification');
  });
});
