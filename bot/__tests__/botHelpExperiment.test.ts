import {
  describe, expect, it, jest,
} from '@jest/globals';
import OpenAI from 'openai';
import archiveRules from '../experiments/botHelp/archiveRules';
import { helpCases } from '../experiments/botHelp/cases';
import {
  formatHelpAnswer, indexText, measureCopyExample, measureRetrieval, prepareVerifiedRules, renderReport, runExperiment,
  sourceHash, validateSample, wikiContextForPage,
} from '../experiments/botHelp/experiment';

const [testCase] = helpCases;
const generalCase = helpCases[12];
const source = {
  id: testCase.expectedSources[0],
  title: 'Help',
  topic: 'user-talk' as const,
  url: 'https://example.org/help',
  revision: '123',
  text: testCase.evidence[0],
};
const plainAnswer = JSON.stringify({ explanation: 'Answer', example: 'none' });
const hit = { sourceId: source.id, score: 1, text: source.text };

function fakeClient() {
  return {
    files: {
      create: jest.fn(async () => ({ id: 'file' })),
      delete: jest.fn(async () => {}),
    },
    vectorStores: {
      create: jest.fn(async () => ({ id: 'store' })),
      delete: jest.fn(async () => {}),
      fileBatches: {
        createAndPoll: jest.fn(async () => ({
          status: 'completed', file_counts: { completed: 1, failed: 0, cancelled: 0 },
        })),
      },
      search: jest.fn(async () => ({
        data: [{ file_id: 'file', score: 1, content: [{ text: source.text }] }],
      })),
    },
    responses: {
      create: jest.fn(async (): Promise<{
        status: string; output_text: string; usage?: { input_tokens: number; output_tokens: number };
      }> => ({
        status: 'completed', output_text: plainAnswer, usage: { input_tokens: 10, output_tokens: 1 },
      })),
    },
  };
}

describe('bot help experiment', () => {
  it('keeps retrieval metrics independent and omits inapplicable metrics', () => {
    expect(measureRetrieval(testCase, [hit])).toStrictEqual({ sourceHit: true, evidenceHit: true });
    expect(measureRetrieval(testCase, [{ ...hit, text: 'unrelated' }])).toStrictEqual({
      sourceHit: true, evidenceHit: false,
    });
    expect(measureRetrieval(helpCases[10], [])).toStrictEqual({ sourceHit: null, evidenceHit: null });
  });

  it('distinguishes a template reference from copy-ready wikitext', () => {
    expect(measureCopyExample(testCase, '{{תב|תיבת ארכיון אוטומטי}}')).toBe(false);
    expect(measureCopyExample(testCase, '<code>{{תיבת ארכיון אוטומטי}}</code>')).toBe(false);
    expect(measureCopyExample(testCase, '<code><nowiki>{{תיבת ארכיון אוטומטי}}</nowiki></code>')).toBe(true);
    expect(measureCopyExample(helpCases[10], '{{תב|תיבת ארכיון אוטומטי}}')).toBeNull();
  });

  it('renders only the verified example and preserves template references', () => {
    const snippet = '{{תיבת ארכיון אוטומטי}}';
    const wrapped = `<code><nowiki>${snippet}</nowiki></code>`;
    const prepared = prepareVerifiedRules([`Use ${wrapped}`]);

    expect(prepared).toStrictEqual({ text: ['Use EXAMPLE_1'], examples: { EXAMPLE_1: snippet } });
    expect(formatHelpAnswer({ explanation: 'ראו {{תב|תיבת ארכיון אוטומטי}}', example: 'EXAMPLE_1' }, prepared.examples))
      .toBe(`ראו {{תב|תיבת ארכיון אוטומטי}}\n\n${wrapped}`);
  });

  it.each(['<pre>{{מצב}}</pre>', '{{מצב}}', '|ארכוב=ארכיון', ' '])(
    'rejects unverified markup and empty explanations (%s)',
    (explanation) => {
      expect(formatHelpAnswer({ explanation, example: 'none' }, {})).toBeNull();
    },
  );

  it('rejects selection of an example outside the allowlist', () => {
    expect(formatHelpAnswer({ explanation: 'ראו {{תב|מצב}}', example: 'EXAMPLE_2' }, { EXAMPLE_1: '{{מצב}}' }))
      .toBeNull();
  });

  it('keeps each evaluated example in the verified rules for its own archiver', () => {
    const rulesByTopic = new Map(archiveRules.map((rule) => [rule.topic, rule.text]));
    const matches = helpCases.filter((sample) => sample.copyExample)
      .map((sample) => measureCopyExample(sample, String(rulesByTopic.get(sample.topic))));

    expect(matches).toStrictEqual([true, true, true, true, true, true]);
  });

  it('selects only live configuration matching the requested page', () => {
    const rule = {
      page: 'Requested page',
      statuses: ['Done'],
      daysAfterLastActivity: 7,
      archiveType: 'תבנית ארכיון עם יעד' as const,
      archiveNavigatePage: 'Archive navigation',
      targetedArchiveRegularArchiveMode: 'תבנית הועבר' as const,
      addNewState: true,
      updateInDiscussionState: false,
    };
    const context = wikiContextForPage(rule.page, '2026-11-18T00:00:00Z', [{ ...rule, page: 'Other page' }, rule]);

    expect(context).toStrictEqual({ page: rule.page, lastEditedAt: '2026-11-18T00:00:00Z', configuration: [rule] });
  });

  it('labels and fingerprints sources', () => {
    expect(indexText(source)).toContain(source.url);
    expect(sourceHash(source)).not.toStrictEqual(sourceHash({ ...source, revision: '124' }));
  });

  it('rejects invalid source and case counts, duplicate IDs, empty sources, and oversized content', () => {
    expect(() => validateSample([], [testCase])).toThrow('1-20 sources');
    expect(() => validateSample(Array(21).fill(source), [testCase])).toThrow('1-20 sources');
    expect(() => validateSample([source], [])).toThrow('1-13 cases');
    expect(() => validateSample([source], Array(14).fill(testCase))).toThrow('1-13 cases');
  });

  it('rejects duplicate, empty and oversized sources', () => {
    expect(() => validateSample([source, source], [testCase])).toThrow('Duplicate');
    expect(() => validateSample([{ ...source, text: ' ' }], [testCase])).toThrow('empty');
    expect(() => validateSample([{ ...source, text: 'x'.repeat(500_000) }], [testCase])).toThrow('500 KB');
  });

  it('checkpoints completed answers and deletes temporary resources', async () => {
    const client = fakeClient();
    const checkpoint = jest.fn(async () => {});
    const { results, cleanupErrors } = await runExperiment(client as unknown as OpenAI, [source], [testCase, generalCase], 'test-model', checkpoint);

    expect(checkpoint).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({
      sourceHit: true, evidenceHit: true, inputTokens: 10, outputTokens: 1,
    });
    expect(cleanupErrors).toStrictEqual([]);
    expect(client.files.delete).toHaveBeenCalledTimes(1);
    expect(renderReport(results, 'test-model')).toContain('Expected source found in top 5 chunks: 1/1.');
  });

  it('scopes known topics and sends live context separately from indexed evidence', async () => {
    const client = fakeClient();
    const context = { page: 'Requested page', lastEditedAt: '2026-11-18T00:00:00Z', configuration: [] };
    const rules = { ...source, id: 'rule:user-talk', text: 'Verified behavior' };
    const checkpoint = jest.fn(async () => {});
    const { results } = await runExperiment(
      client as unknown as OpenAI,
      [rules],
      [testCase, generalCase],
      'test-model',
      checkpoint,
      new Map([[testCase.id, context]]),
    );

    expect(client.vectorStores.fileBatches.createAndPoll.mock.calls).toStrictEqual([['store', {
      files: [{ file_id: 'file', attributes: { topic: 'user-talk' } }],
    }]]);
    expect(client.vectorStores.search.mock.calls).toStrictEqual([
      ['store', {
        query: testCase.question,
        max_num_results: 5,
        rewrite_query: true,
        filters: { type: 'eq', key: 'topic', value: 'user-talk' },
      }],
      ['store', { query: generalCase.question, max_num_results: 5, rewrite_query: true }],
    ]);
    expect(client.responses.create.mock.calls).toStrictEqual([
      [expect.objectContaining({ input: expect.stringContaining('"verifiedRules":["Verified behavior"]') })],
      [expect.objectContaining({ input: expect.stringContaining('"wikiContext":null') })],
    ]);
    expect(results[0].wikiContext).toStrictEqual(context);
  });

  it('asks for a page before attempting a diagnosis that requires one', async () => {
    const client = fakeClient();
    const checkpoint = jest.fn(async () => {});
    const { results } = await runExperiment(client as unknown as OpenAI, [source], [helpCases[10]], 'test-model', checkpoint);

    expect(client.vectorStores.search).not.toHaveBeenCalled();
    expect(client.responses.create).not.toHaveBeenCalled();
    expect(results[0].answer).toContain('באיזה דף או דיון מדובר?');
  });

  it('records correct example selection independently of formatting', async () => {
    const client = fakeClient();
    const output = JSON.stringify({ explanation: '{{תיבת ארכיון אוטומטי}}', example: 'EXAMPLE_1' });
    client.responses.create.mockResolvedValueOnce({ status: 'completed', output_text: output });
    const rule = { ...source, ...archiveRules[0] };
    const checkpoint = jest.fn(async () => {});
    const { results } = await runExperiment(client as unknown as OpenAI, [rule], [testCase], 'test-model', checkpoint);

    expect(results[0]).toMatchObject({ expectedExampleSelected: true, copyExampleHit: false, rejectedOutput: output });
  });

  it('records rejected model output separately from the formatted answer', async () => {
    const client = fakeClient();
    const output = JSON.stringify({ explanation: '<pre>{{מצב}}</pre>', example: 'none' });
    client.responses.create.mockResolvedValueOnce({ status: 'completed', output_text: output });
    const checkpoint = jest.fn(async () => {});
    const context = { page: 'Requested page', lastEditedAt: '2026-11-18T00:00:00Z', configuration: [] };
    const { results } = await runExperiment(
      client as unknown as OpenAI,
      [source],
      [helpCases[10]],
      'test-model',
      checkpoint,
      new Map([[helpCases[10].id, context]]),
    );

    expect(results[0]).toMatchObject({ answer: '', rejectedOutput: output });
    expect(renderReport(results, 'test-model')).toContain('### Rejected raw model output');
  });

  it('cleans up even when indexing fails', async () => {
    const client = fakeClient();
    client.vectorStores.fileBatches.createAndPoll.mockRejectedValueOnce(new Error('Indexing failed'));

    await expect(runExperiment(client as unknown as OpenAI, [source], [testCase], 'test-model', async () => {}))
      .rejects.toThrow('Indexing failed');
    expect(client.files.delete).toHaveBeenCalledTimes(1);
  });
});

describe('bot help experiment response handling', () => {
  it('rejects an incomplete index', async () => {
    const client = fakeClient();
    client.vectorStores.fileBatches.createAndPoll.mockResolvedValueOnce({
      status: 'completed', file_counts: { completed: 0, failed: 0, cancelled: 0 },
    });

    await expect(runExperiment(client as unknown as OpenAI, [source], [testCase], 'test-model', async () => {}))
      .rejects.toThrow('Not all experiment sources');
  });

  it('rejects unknown search files', async () => {
    const client = fakeClient();
    client.vectorStores.search.mockResolvedValueOnce({
      data: [{ file_id: 'unknown', score: 1, content: [{ text: 'Other document' }] }],
    });

    await expect(runExperiment(client as unknown as OpenAI, [source], [testCase], 'test-model', async () => {}))
      .rejects.toThrow('unknown experiment file');
  });

  it('rejects blank answers', async () => {
    const client = fakeClient();
    client.responses.create.mockResolvedValueOnce({
      status: 'completed', output_text: ' ', usage: { input_tokens: 10, output_tokens: 1 },
    });

    await expect(runExperiment(client as unknown as OpenAI, [source], [testCase], 'test-model', async () => {}))
      .rejects.toThrow('Incomplete answer');
  });

  it('records zero usage if the response omits token counts', async () => {
    const client = fakeClient();
    client.responses.create.mockResolvedValueOnce({ status: 'completed', output_text: plainAnswer });
    const checkpoint = jest.fn(async () => {});
    const { results } = await runExperiment(client as unknown as OpenAI, [source], [testCase], 'test-model', checkpoint);

    expect(results[0]).toMatchObject({ inputTokens: 0, outputTokens: 0 });
  });

  it('reports temporary-resource cleanup failures', async () => {
    const client = fakeClient();
    client.vectorStores.delete.mockRejectedValueOnce(new Error('Deletion failed'));
    const { cleanupErrors } = await runExperiment(client as unknown as OpenAI, [source], [testCase], 'test-model', async () => {});

    expect(cleanupErrors).toHaveLength(1);
    expect(client.files.delete).toHaveBeenCalledTimes(1);
  });
});
