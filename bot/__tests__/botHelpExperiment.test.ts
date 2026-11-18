import {
  describe, expect, it, jest,
} from '@jest/globals';
import OpenAI from 'openai';
import { helpCases } from '../experiments/botHelp/cases';
import {
  indexText, measureRetrieval, renderReport, runExperiment, sourceHash, validateSample,
} from '../experiments/botHelp/experiment';

const [testCase] = helpCases;
const source = {
  id: testCase.expectedSources[0],
  title: 'Help',
  url: 'https://example.org/help',
  revision: '123',
  text: testCase.evidence[0],
};
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
        status: 'completed', output_text: 'Answer', usage: { input_tokens: 10, output_tokens: 1 },
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

  it('labels and fingerprints sources', () => {
    expect(indexText(source)).toContain(source.url);
    expect(sourceHash(source)).not.toStrictEqual(sourceHash({ ...source, revision: '124' }));
  });

  it('rejects invalid source and case counts, duplicate IDs, empty sources, and oversized content', () => {
    expect(() => validateSample([], [testCase])).toThrow('1-20 sources');
    expect(() => validateSample(Array(21).fill(source), [testCase])).toThrow('1-20 sources');
    expect(() => validateSample([source], [])).toThrow('1-12 cases');
    expect(() => validateSample([source], Array(13).fill(testCase))).toThrow('1-12 cases');
  });

  it('rejects duplicate, empty and oversized sources', () => {
    expect(() => validateSample([source, source], [testCase])).toThrow('Duplicate');
    expect(() => validateSample([{ ...source, text: ' ' }], [testCase])).toThrow('empty');
    expect(() => validateSample([{ ...source, text: 'x'.repeat(500_000) }], [testCase])).toThrow('500 KB');
  });

  it('checkpoints completed answers and deletes temporary resources', async () => {
    const client = fakeClient();
    const checkpoint = jest.fn(async () => {});
    const { results, cleanupErrors } = await runExperiment(client as unknown as OpenAI, [source], [testCase, helpCases[10]], 'test-model', checkpoint);

    expect(checkpoint).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({
      sourceHit: true, evidenceHit: true, inputTokens: 10, outputTokens: 1,
    });
    expect(cleanupErrors).toStrictEqual([]);
    expect(client.files.delete).toHaveBeenCalledTimes(1);
    expect(renderReport(results, 'test-model')).toContain('Expected source found in top 5 chunks: 1/1.');
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
    client.responses.create.mockResolvedValueOnce({ status: 'completed', output_text: 'Answer' });
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
