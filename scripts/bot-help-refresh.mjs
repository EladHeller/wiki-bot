import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { operationSourcePath, repositorySource } from '../dist/tag-bot/help/codeSources.js';
import answerFromKnowledge from '../dist/tag-bot/help/knowledgeAnswer.js';
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
  const scope = `sapper-bot-help-ci-${randomUUID()}`;
  try {
    const first = await refreshKnowledgeIndex(client, sources, scope);
    const unchanged = await refreshKnowledgeIndex(client, sources, scope);
    const revised = sources.map(({ title, text }, index) => ({ title, text: index === 0 ? `${text}\n` : text }));
    const second = await refreshKnowledgeIndex(client, revised, scope);
    if (first.uploaded !== sources.length || unchanged.changed || second.uploaded !== 1) {
      throw new Error('Unexpected file upload count during staged refresh');
    }
    const models = ['gpt-4o-mini', 'gpt-4.1-mini'];
    const checks = await Promise.all(models.map(async (model) => {
      const documentation = await answerFromKnowledge(
        client, model, 'מאיפה Sapper-bot מביא את המצעד השבועי של מדיה פורסט?', scope,
      );
      const code = await answerFromKnowledge(
        client, model, 'מה עושה בוט עיצוב שנות הפעילות בערכים של כדורסלנים?', scope,
      );
      const docsPass = Boolean(documentation?.includes('מקורות:') && documentation.includes('מדיה פורסט'));
      const codePass = Boolean(code?.includes('שנים')
        && code.includes('סדר בשדות תאריכים בתבניות אישיות ספורט'));
      console.log(`${model}: documentation ${docsPass}, repository evidence ${codePass}`);
      if (code) console.log(`${model} sports answer:\n${code}`);
      return docsPass && codePass;
    }));
    if (!checks[0]) throw new Error('The default model did not pass grounded help verification');
    console.log(`Verified initial indexing, unchanged snapshot, one changed file and a sourced answer (${sources.length} sources).`);
  } finally {
    const files = new Set();
    for await (const index of client.vectorStores.list({ limit: 100 })) {
      if (index.metadata?.scope !== scope) continue;
      for await (const file of client.vectorStores.files.list(index.id, { limit: 100 })) files.add(file.id);
      await client.vectorStores.delete(index.id);
    }
    await Promise.all(Array.from(files, (id) => client.files.delete(id)));
  }
} else {
  const result = await refreshKnowledgeIndex(client, sources);
  console.log(`Help documentation: ${sources.length} sources. New snapshot: ${result.changed}. Files uploaded: ${result.uploaded}.`);
}
