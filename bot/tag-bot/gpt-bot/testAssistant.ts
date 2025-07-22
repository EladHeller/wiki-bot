import OpenAI from 'openai';

const assistantId = process.env.ASSISTANT_ID;
const openai = new OpenAI();

// 'האם יש חשש שהבוט בטעות ימחק דפים בלי כוונה?
export default async function testAssistant(question: string) {
  if (!assistantId) {
    throw new Error('No assistant ID');
  }
  /* Helper creates thread + run and waits until the run is DONE */
  const run = await openai.beta.threads.createAndRunPoll({
    assistant_id: assistantId,
    model: 'gpt-4-turbo',
    thread: { messages: [{ role: 'user', content: question }] },
    temperature: 1,
  });

  /* createAndRunPoll() gives us only the Run – now pull the last reply */
  const messages = await openai.beta.threads.messages.list(run.thread_id!, {
    order: 'desc',
    limit: 1,
  });
  const content = messages.data[0].content[0];
  if (content.type === 'text') {
    console.log(`\n🗨️  Reply:\n${content.text.value}`);
  }
}
