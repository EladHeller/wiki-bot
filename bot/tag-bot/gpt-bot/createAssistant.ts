import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const openai = new OpenAI();
const corpusDir = path.join(__dirname, 'corpus');

export default async function createAssistant() {
  const instructions = await fs.promises.readFile(`${__dirname}/instructions.txt`, 'utf-8');

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

  const assistant = await openai.beta.assistants.create({
    name: 'Wiki-bot',
    model: 'gpt-4o-mini',
    instructions,
    tools: [{ type: 'file_search' }],
    tool_resources: {
      file_search: { vector_store_ids: [vectorStore.id] },
    },
  });

  console.log('Assistant ready →', assistant.id);
}
