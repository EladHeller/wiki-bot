import OpenAI from 'openai';
import fs from 'node:fs/promises';

const vectorId = process.env.VECTOR_STORE_ID;
const openai = new OpenAI();
let instructions = '';
export default async function askGPT(question: string) {
  if (!instructions.length) {
    instructions = await fs.readFile(`${__dirname}/instructions.txt`, 'utf-8');
  }
  if (!vectorId) {
    throw new Error('No assistant ID');
  }
  const resp = await openai.responses.create({
    model: 'gpt-4o-mini',
    instructions,
    input: question,
    tool_choice: {
      type: 'file_search',
    },
    tools: [{
      vector_store_ids: [vectorId],
      type: 'file_search',
    }],
  });
  return resp.output_text;
}
