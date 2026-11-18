import { createHash } from 'node:crypto';
import OpenAI, { toFile } from 'openai';

export const knowledgeScope = 'sapper-bot-help-hewiki-v1';

export const knowledgePages: readonly string[] = [
  'משתמש:Sapper-bot',
  'משתמש:Sapper-bot/בוט התיוג',
  'ויקיפדיה:בוט/בוט ארכוב אוטומטי',
  'ויקיפדיה:בוט/ארכוב דיונים',
  'תבנית:בוט ארכוב אוטומטי',
  'תבנית:תיבת ארכיון אוטומטי',
  'ויקיפדיה:בוט/קישורי שפה',
  'ויקיפדיה:בוט/בוט מצעדים/מדיה פורסט',
  'ויקיפדיה:בוט/הסרת דפי טיוטה מקטגוריות של מרחב הערכים',
  'ויקיפדיה:בוט/ניקוי ערכי אין ולא ידוע בתבנית מידע',
];

export type KnowledgeSource = { title: string; text: string };
type Index = OpenAI.VectorStores.VectorStore;
type ReadyIndex = Index & { metadata: NonNullable<Index['metadata']> };
type IndexedFile = OpenAI.VectorStores.VectorStoreFile;

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

async function* readyIndexes(client: OpenAI, scope: string): AsyncGenerator<ReadyIndex> {
  for await (const index of client.vectorStores.list({ order: 'desc', limit: 100 })) {
    if (index.status === 'completed' && index.metadata?.scope === scope && index.metadata.state === 'ready') {
      yield { ...index, metadata: index.metadata };
    }
  }
}

export async function findKnowledgeIndex(client: OpenAI, scope = knowledgeScope): Promise<string | null> {
  const index = await readyIndexes(client, scope).next();
  return index.value?.id ?? null;
}

async function readFiles(client: OpenAI, id: string): Promise<IndexedFile[]> {
  const files: IndexedFile[] = [];
  for await (const file of client.vectorStores.files.list(id, { limit: 100 })) {
    files.push(file);
  }
  return files;
}

async function pruneOldIndexes(client: OpenAI, indexes: Index[]): Promise<void> {
  const [current, previous, ...superseded] = indexes;
  if (!superseded.length) return;
  const preserved = new Set((await Promise.all([current, previous].map(({ id }) => readFiles(client, id))))
    .flatMap((files) => files.map(({ id }) => id)));
  const orphaned = new Set<string>();
  for (const index of superseded) {
    const files = await readFiles(client, index.id);
    await client.vectorStores.delete(index.id);
    files.filter(({ id }) => !preserved.has(id)).forEach(({ id }) => orphaned.add(id));
  }
  await Promise.all(Array.from(orphaned, (id) => client.files.delete(id)));
}

export async function refreshKnowledgeIndex(
  client: OpenAI,
  sources: readonly KnowledgeSource[],
  scope = knowledgeScope,
): Promise<{ uploaded: number; changed: boolean }> {
  const entries = sources.map(({ title, text }) => ({ title, text, digest: sha256(text) }))
    .sort((a, b) => a.title.localeCompare(b.title));
  if (entries.length === 0 || entries.some(({ text }) => !text.trim())
    || new Set(entries.map(({ title }) => title)).size !== entries.length) {
    throw new Error('Help index requires unique, nonempty sources');
  }
  const digest = sha256(JSON.stringify(entries.map(({ title, digest: hash }) => [title, hash])));
  const existing: ReadyIndex[] = [];
  for await (const index of readyIndexes(client, scope)) existing.push(index);
  const [active] = existing;
  if (active?.metadata.digest === digest) {
    await pruneOldIndexes(client, existing);
    return { uploaded: 0, changed: false };
  }

  const previousFiles = active ? await readFiles(client, active.id) : [];
  const oldFileIds = new Map(previousFiles.map(({ id, attributes }) => [
    JSON.stringify([attributes?.title, attributes?.digest]), id,
  ]));
  const pending = await client.vectorStores.create({
    name: scope,
    metadata: { scope, state: 'pending', digest },
    expires_after: { anchor: 'last_active_at', days: 1 },
  });
  const uploaded: string[] = [];
  let published: Index;
  try {
    const batchFiles: OpenAI.VectorStores.FileBatchCreateParams.File[] = [];
    for (let offset = 0; offset < entries.length; offset += 10) {
      const outcomes = await Promise.allSettled(entries.slice(offset, offset + 10).map(async (entry) => {
        const attributes = { title: entry.title, digest: entry.digest };
        let fileId = oldFileIds.get(JSON.stringify([entry.title, entry.digest]));
        if (!fileId) {
          const content = `# ${entry.title}\n\n${entry.text}`;
          const file = await client.files.create({
            file: await toFile(Buffer.from(content), `${scope}-${entry.digest}.md`),
            purpose: 'assistants',
          });
          fileId = file.id;
          uploaded.push(fileId);
        }
        return { file_id: fileId, attributes };
      }));
      outcomes.forEach((outcome) => {
        if (outcome.status === 'rejected') throw outcome.reason;
        batchFiles.push(outcome.value);
      });
    }
    const batch = await client.vectorStores.fileBatches.createAndPoll(pending.id, { files: batchFiles });
    if (batch.status !== 'completed' || batch.file_counts.completed !== entries.length) {
      throw new Error('Help index did not process every source');
    }
    published = await client.vectorStores.update(pending.id, {
      metadata: { scope, state: 'ready', digest },
      expires_after: null,
    });
  } catch (error) {
    await Promise.allSettled([
      client.vectorStores.delete(pending.id),
      ...uploaded.map((id) => client.files.delete(id)),
    ]);
    throw error;
  }

  await pruneOldIndexes(client, [published, ...existing]);
  return { uploaded: uploaded.length, changed: true };
}
