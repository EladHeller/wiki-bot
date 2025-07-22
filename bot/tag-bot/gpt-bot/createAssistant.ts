import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const openai = new OpenAI();
const corpusDir = path.join(__dirname, 'corpus');

export default async function createAssistant() {
  const fileIds: string[] = [];
  for (const name of await fs.promises.readdir(corpusDir)) {
    const full = path.join(corpusDir, name);
    if ((await fs.promises.stat(full)).isFile()) {
      const f = await openai.files.create({
        file: fs.createReadStream(full),
        purpose: 'assistants',
      });
      fileIds.push(f.id);
    }
  }

  const vectorStore = await openai.vectorStores.create({
    name: 'Wiki-policy store',
    file_ids: fileIds,
  });
  console.log('vectorStore ready →', vectorStore.id);
}
