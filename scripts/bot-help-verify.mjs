import { randomUUID } from 'node:crypto';
import answerFromKnowledge from '../dist/tag-bot/help/knowledgeAnswer.js';
import { refreshKnowledgeIndex } from '../dist/tag-bot/help/knowledgeIndex.js';

export default async function verifyKnowledgeIndex(client, sources) {
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
}
