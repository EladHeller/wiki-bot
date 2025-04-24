import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI();

export default async function createAssistant() {
  const instructions = await fs.promises.readFile(`${__dirname}/instructions.txt`, 'utf-8');
  const vectorStore = await openai.vectorStores.create({
    name: 'wiki_knowledge',
  });
  await openai.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {
    files: [fs.createReadStream(`${__dirname}/wikipedia-policies.txt`), fs.createReadStream(`${__dirname}/bot-explain.txt`)],
  });

  const assistant = await openai.beta.assistants.create({
    name: 'Sapper-bot',
    instructions,
    tools: [{
      type: 'file_search',
    }],
    model: 'gpt-4-turbo',
  });

  await openai.beta.assistants.update(assistant.id, {
    tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
  });

  console.log({
    assistant: assistant.id,
    vectorStore: vectorStore.id,
  });
}
