import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
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

if (process.argv.includes('--prepare')) {
  console.log(`Prepared ${sources.length} public documentation sources.`);
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
    const answer = await answerFromKnowledge(
      client, 'gpt-4o-mini', 'מאיפה Sapper-bot מביא את המצעד השבועי של מדיה פורסט?', scope,
    );
    if (!answer?.includes('מקורות:') || !answer.includes('מדיה פורסט')) {
      throw new Error('No sourced answer from the staged documentation index');
    }
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
