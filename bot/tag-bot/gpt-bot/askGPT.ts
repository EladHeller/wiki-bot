import OpenAI from 'openai';
import instructions from './instructions';

const vectorId = process.env.VECTOR_STORE_ID;
const openai = new OpenAI();
export default async function askGPT(question: string) {
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
