import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { operationSourcePath, repositorySource } from '../dist/tag-bot/help/codeSources.js';
import { knowledgePages, refreshKnowledgeIndex } from '../dist/tag-bot/help/knowledgeIndex.js';

const params = new URLSearchParams({
  action: 'query', format: 'json', formatversion: '2', prop: 'revisions',
  rvprop: 'content', rvslots: 'main', titles: knowledgePages.join('|'),
});
const response = await fetch(`https://he.wikipedia.org/w/api.php?${params}`, {
  headers: { 'User-Agent': 'Sapper-bot-help/1.0 (https://github.com/EladHeller/wiki-bot)' },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`Wikipedia snapshot failed: HTTP ${response.status}`);
const data = await response.json();
if (data.error || !Array.isArray(data.query?.pages)) throw new Error('Wikipedia did not return the help sources');

const sources = knowledgePages.map((title) => {
  const page = data.query.pages.find((entry) => entry.title === title);
  const text = page?.revisions?.[0]?.slots?.main?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error(`Missing help documentation: ${title}`);
  return {
    title,
    text: text
      .replace(/^\{\|[^\n]*\bid\s*=\s*["']?archive-config["']?[^\n]*\n[\s\S]*?^\|\}/gm, '')
      .replace(/^==[ \t]*רשימת משתמשים[ \t]*==[^\n]*\n(?:(?!^==[^=])[\s\S])*/gm, ''),
  };
});

const root = new URL('..', import.meta.url);
const trackedPaths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(operationSourcePath);
const indexedCode = await Promise.all(trackedPaths.map(async (path) => {
  const title = `code:${path}`;
  const metadata = repositorySource(title);
  return {
    title,
    text: `${metadata.label}\n\n${await readFile(new URL(path, root), 'utf8')}`,
  };
}));
sources.push(...indexedCode);

if (process.argv.includes('--prepare')) {
  console.log(`Prepared ${knowledgePages.length} wiki pages and ${indexedCode.length} tracked code and configuration files.`);
  process.exit(0);
}

const client = new OpenAI({ maxRetries: 0, timeout: 60_000 });
if (process.argv.includes('--verify')) {
  const { default: verifyKnowledgeIndex } = await import('./bot-help-verify.mjs');
  await verifyKnowledgeIndex(client, sources);
} else {
  const result = await refreshKnowledgeIndex(client, sources);
  console.log(`Help documentation: ${sources.length} sources. New snapshot: ${result.changed}. Files uploaded: ${result.uploaded}.`);
}
