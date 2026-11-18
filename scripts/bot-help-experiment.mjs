import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import {
  codeSources, wikiSources, sourceHash, indexText, validateSample, runExperiment, renderReport, wikiContextForPage,
} from '../dist/experiments/botHelp/experiment.js';
import { helpCases } from '../dist/experiments/botHelp/cases.js';
import archiveRules from '../dist/experiments/botHelp/archiveRules.js';
import { parseArchiveConfiguration } from '../dist/maintenance/closedDiscussionsArchiveBot/ClosedDiscussionsArchiveBotModel.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'experiment-output/bot-help');
const model = process.env.BOT_HELP_MODEL || 'gpt-4o-mini';
const prepareOnly = process.argv.includes('--prepare');
if (process.argv.slice(2).some((argument) => argument !== '--prepare')) throw new Error('Only --prepare is supported');
await fs.mkdir(output, { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sources = await Promise.all(codeSources.map(async (source) => ({
  id: source.id,
  topic: source.topic,
  title: source.path,
  url: `https://github.com/EladHeller/wiki-bot/blob/${revision}/${source.path}`,
  revision,
  text: await fs.readFile(path.join(root, source.path), 'utf8'),
})));
sources.push(...archiveRules.map(({ path: sourcePath, ...rule }) => ({
  ...rule, revision, url: `https://github.com/EladHeller/wiki-bot/blob/${revision}/${sourcePath}`,
})));
async function readWikiRevisions(titles, withContent = true) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
    rvprop: withContent ? 'ids|timestamp|content' : 'ids|timestamp', rvslots: 'main', titles: titles.join('|'),
  });
  const response = await fetch(`https://he.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'Sapper-bot-help-experiment/1.0 (https://github.com/EladHeller/wiki-bot)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Wikipedia snapshot failed: HTTP ${response.status}`);
  const data = await response.json();
  if (data.error || !Array.isArray(data.query?.pages)) throw new Error('Wikipedia returned no snapshot pages');
  return new Map(data.query.pages.map((page) => [page.title, page.revisions?.[0]]));
}
const revisions = await readWikiRevisions(wikiSources.map((source) => source.title));
for (const source of wikiSources) {
  const rev = revisions.get(source.title);
  const text = rev?.slots?.main?.content;
  if (!rev?.revid || typeof text !== 'string' || !text.trim()) throw new Error(`Missing wiki source: ${source.title}`);
  sources.push({
    id: source.id, title: source.title, topic: source.topic,
    url: `https://he.wikipedia.org/w/index.php?oldid=${rev.revid}`,
    revision: String(rev.revid), text,
  });
}
validateSample(sources, helpCases);
const contextCases = helpCases.filter((testCase) => testCase.contextPage);
const liveRevisions = await readWikiRevisions(contextCases.map((testCase) => testCase.contextPage), false);
const configurationTitle = wikiSources.find((source) => source.id === 'wiki:closed-help').title;
const liveConfig = await readWikiRevisions([configurationTitle]);
const configContent = liveConfig.get(configurationTitle)?.slots?.main?.content;
if (!configContent) throw new Error('Missing live archive configuration');
const rules = parseArchiveConfiguration(configContent);
const wikiContexts = new Map(contextCases.map(({ id, contextPage }) => {
  const revision = liveRevisions.get(contextPage);
  if (!revision?.timestamp) throw new Error(`Missing revision for live context page: ${contextPage}`);
  return [id, wikiContextForPage(contextPage, revision.timestamp, rules)];
}));
await fs.writeFile(path.join(output, 'corpus.json'), JSON.stringify(sources, null, 2));
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({
  capturedAt: new Date().toISOString(), revision,
  sources: sources.map((source) => ({ ...source, text: undefined, hash: sourceHash(source), bytes: Buffer.byteLength(indexText(source)) })),
  cases: helpCases,
  wikiContexts: Object.fromEntries(wikiContexts),
}, null, 2));
console.log(`Prepared ${sources.length} sources and ${helpCases.length} cases.`);
if (!prepareOnly) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for the live experiment. No model results were produced.');
  const client = new OpenAI({ maxRetries: 0, timeout: 60_000 });
  const checkpoint = async (results) => {
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    await fs.writeFile(path.join(output, 'report.md'), renderReport(results, model));
  };
  const { results, cleanupErrors } = await runExperiment(client, sources, helpCases, model, checkpoint, wikiContexts);
  await fs.writeFile(path.join(output, 'report.md'), renderReport(results, model, cleanupErrors));
  console.log(`Completed ${results.length} cases. See experiment-output/bot-help/report.md.`);
  if (cleanupErrors.length) process.exitCode = 1;
}
