import {
  describe, expect, it, jest,
} from '@jest/globals';
import { createHash } from 'node:crypto';
import type OpenAI from 'openai';
import { operationSourcePath, repositorySource } from '../tag-bot/help/codeSources';
import answerFromKnowledge from '../tag-bot/help/knowledgeAnswer';
import {
  findKnowledgeIndex, knowledgePages, knowledgeScope, refreshKnowledgeIndex,
} from '../tag-bot/help/knowledgeIndex';

const scope = 'test-space';
const question = 'איך עובד מצעד מדיה פורסט?';
const extract = 'בוט מדיה פורסט מעדכן את המצעד השבועי לפי דף הנתונים של מדיה פורסט.';
const [title, secondTitle] = knowledgePages;
const first = { title, text: 'bot overview' };
const second = { title: secondTitle, text: 'bot tag commands' };
const loaded = { id: 'active', status: 'completed', metadata: { scope, state: 'ready' } };

async function* items<T>(values: T[]) {
  yield* values;
}

function fakeOpenAI() {
  return {
    files: {
      create: jest.fn(async () => ({ id: 'new-document' })),
      delete: jest.fn(async () => {}),
    },
    vectorStores: {
      list: jest.fn(() => items([loaded])),
      create: jest.fn(async () => ({ id: 'new-index' })),
      update: jest.fn(async () => ({ ...loaded, id: 'new-index' })),
      delete: jest.fn(async () => {}),
      files: {
        list: jest.fn(() => items<{ id: string; attributes: { title: string; digest: string } | null }>([])),
      },
      fileBatches: {
        createAndPoll: jest.fn(async () => ({ status: 'completed', file_counts: { completed: 2 } })),
      },
      search: jest.fn(async (): Promise<{
        data: { attributes: Record<string, string> | null; content: { text: string }[] }[];
      }> => ({
        data: [{ attributes: { title }, content: [{ text: extract }] }],
      })),
    },
    responses: {
      create: jest.fn(async () => ({
        status: 'completed', output_text: JSON.stringify({ explanation: 'תשובה מבוססת', citations: ['P1'] }),
      })),
    },
  };
}

function sourceDigest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

const asClient = (mock: ReturnType<typeof fakeOpenAI>) => mock as unknown as OpenAI;

describe('weekly help refresh', () => {
  it('selects the newest complete published index in the requested namespace', async () => {
    const mock = fakeOpenAI();
    mock.vectorStores.list.mockReturnValue(items([
      { ...loaded, status: 'expired' },
      { ...loaded, metadata: { scope: 'different', state: 'ready' } },
      { ...loaded, metadata: { scope, state: 'pending' } },
      loaded,
    ]));

    await expect(findKnowledgeIndex(asClient(mock), scope)).resolves.toBe('active');
    await expect(findKnowledgeIndex(asClient(mock))).resolves.toBeNull();
  });

  it.each([[], [first, first], [{ ...first, text: ' ' }]])('rejects an incomplete source snapshot', async (...rows) => {
    const mock = fakeOpenAI();

    await expect(refreshKnowledgeIndex(asClient(mock), rows, scope)).rejects.toThrow('unique, nonempty sources');
    expect(mock.vectorStores.list).not.toHaveBeenCalled();
  });

  it('builds an initial index and marks it ready only after processing', async () => {
    const mock = fakeOpenAI();
    mock.vectorStores.list.mockReturnValue(items([]));
    const result = await refreshKnowledgeIndex(asClient(mock), [first, second]);

    expect(result).toStrictEqual({ uploaded: 2, changed: true });
    expect(mock.vectorStores.update.mock.calls).toStrictEqual([['new-index', expect.objectContaining({
      metadata: expect.objectContaining({ scope: knowledgeScope, state: 'ready' }),
      expires_after: null,
    })]]);
  });

  it('skips uploads if the active snapshot has the same files', async () => {
    const mock = fakeOpenAI();
    const digest = sourceDigest(JSON.stringify([[title, sourceDigest(first.text)]]));
    mock.vectorStores.list.mockReturnValue(items([{ ...loaded, metadata: { ...loaded.metadata, digest } }]));

    await expect(refreshKnowledgeIndex(asClient(mock), [first], scope))
      .resolves.toStrictEqual({ uploaded: 0, changed: false });
    expect(mock.files.create).not.toHaveBeenCalled();
  });

  it('reuses unchanged files and prunes only unreferenced files in superseded snapshots', async () => {
    const mock = fakeOpenAI();
    const kept = { id: 'shared', attributes: { title, digest: sourceDigest(first.text) } };
    const obsolete = { id: 'obsolete', attributes: null };
    mock.vectorStores.list.mockReturnValue(items([loaded, { ...loaded, id: 'older' }]));
    mock.vectorStores.files.list
      .mockReturnValueOnce(items([kept, obsolete]))
      .mockReturnValueOnce(items([kept]))
      .mockReturnValueOnce(items([kept]))
      .mockReturnValueOnce(items([kept, obsolete]));

    await expect(refreshKnowledgeIndex(asClient(mock), [first, second], scope))
      .resolves.toStrictEqual({ uploaded: 1, changed: true });
    expect(mock.vectorStores.fileBatches.createAndPoll.mock.calls).toStrictEqual([['new-index', {
      files: expect.arrayContaining([expect.objectContaining({ file_id: 'shared' })]),
    }]]);
    expect(mock.vectorStores.delete.mock.calls).toStrictEqual([['older']]);
    expect(mock.files.delete.mock.calls).toStrictEqual([['obsolete']]);
  });

  it('cleans up successful uploads when another upload in the same batch fails', async () => {
    const mock = fakeOpenAI();
    mock.files.create.mockRejectedValueOnce(new Error('Upload rejected'));

    await expect(refreshKnowledgeIndex(asClient(mock), [first, second], scope)).rejects.toThrow('Upload rejected');
    expect(mock.vectorStores.fileBatches.createAndPoll).not.toHaveBeenCalled();
    expect(mock.files.delete).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 'failed', file_counts: { completed: 2 } },
    { status: 'completed', file_counts: { completed: 1 } },
  ])('retains the existing snapshot if replacement fails', async (batch) => {
    const mock = fakeOpenAI();
    mock.vectorStores.fileBatches.createAndPoll.mockResolvedValue(batch);

    await expect(refreshKnowledgeIndex(asClient(mock), [first, second], scope)).rejects.toThrow('did not process');
    expect(mock.vectorStores.update).not.toHaveBeenCalled();
    expect(mock.vectorStores.delete.mock.calls).toStrictEqual([['new-index']]);
    expect(mock.files.delete).toHaveBeenCalledTimes(2);
  });
});

describe('repository sources', () => {
  it.each([
    'bot/scripts/oneTime/example.ts',
    'xmlbot/script.ts',
    'build/t01.cf.yaml',
    'build/wiki-bot-playwright/Dockerfile',
    '.github/workflows/deploy.yml',
    'package.json',
  ])('covers operational source outside the manually labelled examples (%s)', (path) => {
    expect(operationSourcePath(path)).toBe(true);
    expect(repositorySource(`code:${path}`)?.path).toBe(path);
  });

  it.each(['bot/__tests__/example.test.ts', 'bot/../private.ts', 'bot/.env', 'build/random.pem', 'bot/foo.spec.ts'])(
    'excludes test and unrelated paths (%s)',
    (path) => {
      expect(operationSourcePath(path)).toBe(false);
      expect(repositorySource(`code:${path}`)).toBeUndefined();
    },
  );
});

describe('documentation answers', () => {
  it('uses only public source titles from the chunks and adds wiki links itself', async () => {
    const mock = fakeOpenAI();
    mock.vectorStores.search.mockResolvedValue({
      data: [
        { attributes: { title: '[injected]' }, content: [] },
        { attributes: { title }, content: [{ text: extract }] },
      ],
    });
    const answer = await answerFromKnowledge(asClient(mock), 'test-model', question, scope);

    expect(answer).toBe(`תשובה מבוססת\n\nמקורות: [[${title}]]`);
    expect(mock.responses.create.mock.calls).toStrictEqual([[expect.objectContaining({
      input: expect.stringContaining(extract),
    })]]);
  });

  it('declines an underspecified question before search', async () => {
    const mock = fakeOpenAI();

    await expect(answerFromKnowledge(asClient(mock), 'test-model', 'מה הבוט עושה?', scope)).resolves.toBeNull();
    expect(mock.vectorStores.list).not.toHaveBeenCalled();
  });

  it('does not use archiving material to answer a question about basketball players', async () => {
    const mock = fakeOpenAI();
    mock.vectorStores.search.mockResolvedValue({
      data: [{ attributes: { title }, content: [{ text: 'הבוט עוסק בארכוב דפי שיחה באופן אוטומטי.' }] }],
    });

    await expect(answerFromKnowledge(asClient(mock), 'test-model', 'מה עושה הבוט על דפי כדורסלנים?', scope))
      .resolves.toBeNull();
    expect(mock.responses.create).not.toHaveBeenCalled();
  });

  it('links the associated public report when the model cites a code passage', async () => {
    const mock = fakeOpenAI();
    const source = 'code:bot/sportPersonalityTemplatesYearsFormat/model.ts';
    const quote = 'const TEMPLATE_NAMES = ["אישיות כדורגל", "אישיות כדורסל"];';
    mock.vectorStores.search.mockResolvedValue({
      data: [{ attributes: { title: source }, content: [{ text: quote }] }],
    });
    mock.responses.create.mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify({ explanation: 'עיצוב שנים', citations: ['P1'] }),
    });

    await expect(answerFromKnowledge(asClient(mock), 'test-model', 'מה עושה הבוט על דפי כדורסלנים?', scope))
      .resolves.toContain('[[ויקיפדיה:בוט/סדר בשדות תאריכים בתבניות אישיות ספורט]]');
  });

  it('searches English source for an operation without a curated Hebrew label', async () => {
    const mock = fakeOpenAI();
    const source = 'code:bot/scripts/oneTime/fixExample.ts';
    const quote = 'function reconcileSettlementCategories(records) { return records.filter(isSettlement); }';
    mock.vectorStores.search.mockResolvedValue({
      data: [{ attributes: { title: source }, content: [{ text: quote }] }],
    });
    mock.responses.create.mockResolvedValueOnce({
      status: 'completed', output_text: 'settlement categories',
    }).mockResolvedValueOnce({
      status: 'completed',
      output_text: JSON.stringify({ explanation: 'הסקריפט מתאים קטגוריות של יישובים.', citations: ['P1'] }),
    });

    await expect(answerFromKnowledge(asClient(mock), 'test-model', 'איך הסקריפט מתקן קטגוריות יישובים?', scope))
      .resolves.toContain('מתאים קטגוריות של יישובים');
    expect(mock.vectorStores.search).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 'incomplete', output_text: 'settlement' },
    { status: 'completed', output_text: '' },
  ])('falls back to no answer without a useful translated query', async (translation) => {
    const mock = fakeOpenAI();
    mock.vectorStores.search.mockResolvedValue({
      data: [{
        attributes: { title: 'code:bot/scripts/oneTime/fixExample.ts' }, content: [{ text: 'fix settlements' }],
      }],
    });
    mock.responses.create.mockResolvedValueOnce(translation);

    await expect(answerFromKnowledge(asClient(mock), 'test-model', 'איך מטפלים בשינויי יישובים?', scope))
      .resolves.toBeNull();
    expect(mock.vectorStores.search).toHaveBeenCalledTimes(1);
  });

  it('declines when there is no ready index', async () => {
    const mock = fakeOpenAI();

    await expect(answerFromKnowledge(asClient(mock), 'test-model', question)).resolves.toBeNull();
    expect(mock.vectorStores.search).not.toHaveBeenCalled();
  });

  it('declines when search does not have any allowed source', async () => {
    const mock = fakeOpenAI();
    mock.vectorStores.search.mockResolvedValue({ data: [{ attributes: null, content: [] }] });

    await expect(answerFromKnowledge(asClient(mock), 'test-model', question, scope)).resolves.toBeNull();
    expect(mock.responses.create).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'incomplete', output_text: 'Incomplete' },
    { status: 'completed', output_text: '' },
    { status: 'completed', output_text: '{' },
    { status: 'completed', output_text: JSON.stringify({ explanation: '', citations: ['P1'] }) },
    { status: 'completed', output_text: JSON.stringify({ explanation: '{{תבנית}}', citations: ['P1'] }) },
    { status: 'completed', output_text: JSON.stringify({ explanation: 'Explanation', citations: [] }) },
    { status: 'completed', output_text: JSON.stringify({ explanation: 'Explanation', citations: ['P99'] }) },
  ])('does not publish incomplete, unverifiable, or unsafe output', async (response) => {
    const mock = fakeOpenAI();
    mock.responses.create.mockResolvedValue(response);

    await expect(answerFromKnowledge(asClient(mock), 'test-model', question, scope)).resolves.toBeNull();
  });
});
