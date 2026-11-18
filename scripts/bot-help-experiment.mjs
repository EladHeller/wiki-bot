import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import {
  codeSources, wikiSources, sourceHash, indexText, validateSample, runExperiment, renderReport,
} from '../dist/experiments/botHelp/experiment.js';
import { helpCases } from '../dist/experiments/botHelp/cases.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'experiment-output/bot-help');
const model = process.env.BOT_HELP_MODEL || 'gpt-4o-mini';
const prepareOnly = process.argv.includes('--prepare');
if (process.argv.slice(2).some((argument) => argument !== '--prepare')) throw new Error('Only --prepare is supported');
await fs.mkdir(output, { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sources = await Promise.all(codeSources.map(async (source) => ({
  id: source.id,
  title: source.path,
  url: `https://github.com/EladHeller/wiki-bot/blob/${revision}/${source.path}`,
  revision,
  text: await fs.readFile(path.join(root, source.path), 'utf8'),
})));
const params = new URLSearchParams({
  action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
  rvprop: 'ids|timestamp|content', rvslots: 'main', titles: wikiSources.map((source) => source.title).join('|'),
});
const response = await fetch(`https://he.wikipedia.org/w/api.php?${params}`, {
  headers: { 'User-Agent': 'Sapper-bot-help-experiment/1.0 (https://github.com/EladHeller/wiki-bot)' },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`Wikipedia snapshot failed: HTTP ${response.status}`);
const data = await response.json();
if (data.error || !Array.isArray(data.query?.pages)) throw new Error('Wikipedia returned no snapshot pages');
for (const source of wikiSources) {
  const page = data.query.pages.find((item) => item.title === source.title);
  const rev = page?.revisions?.[0];
  const text = rev?.slots?.main?.content;
  if (!rev?.revid || typeof text !== 'string' || !text.trim()) throw new Error(`Missing wiki source: ${source.title}`);
  sources.push({
    id: source.id, title: source.title,
    url: `https://he.wikipedia.org/w/index.php?oldid=${rev.revid}`,
    revision: String(rev.revid), text,
  });
}
validateSample(sources, helpCases);
await fs.writeFile(path.join(output, 'corpus.json'), JSON.stringify(sources, null, 2));
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({
  capturedAt: new Date().toISOString(), revision,
  sources: sources.map((source) => ({ ...source, text: undefined, hash: sourceHash(source), bytes: Buffer.byteLength(indexText(source)) })),
  cases: helpCases,
}, null, 2));
console.log(`Prepared ${sources.length} sources and ${helpCases.length} cases.`);
if (!prepareOnly) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for the live experiment. No model results were produced.');
  const client = new OpenAI({ maxRetries: 0, timeout: 60_000 });
  const checkpoint = async (results) => {
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    await fs.writeFile(path.join(output, 'report.md'), renderReport(results, model));
  };
  const { results, cleanupErrors } = await runExperiment(client, sources, helpCases, model, checkpoint);
  await fs.writeFile(path.join(output, 'report.md'), renderReport(results, model, cleanupErrors));
  console.log(`Completed ${results.length} cases. See experiment-output/bot-help/report.md.`);
  if (cleanupErrors.length) process.exitCode = 1;
}
