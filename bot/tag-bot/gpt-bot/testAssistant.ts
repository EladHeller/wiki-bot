import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const assistantId = process.env.ASSISTANT_ID;

async function poll(thread: OpenAI.Beta.Threads.Thread, run: OpenAI.Beta.Threads.Runs.Run) {
  let status = 'in_progress';
  let runResult: OpenAI.Beta.Threads.Runs.Run;
  while (status === 'in_progress' || status === 'queued') {
    runResult = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    status = runResult.status;
    if (status === 'in_progress' || status === 'queued') {
      console.log('⏳ Waiting for run to complete...');
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      }); // wait 1 second
    } else if (status === 'completed') {
      return runResult;
    }
  }

  if (status !== 'completed') {
    throw new Error(`Run failed with status: ${status}`);
  }
  return null;
}

export default async function testAssistant() {
  if (!assistantId) {
    throw new Error('Missing assitant ID');
  }
  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: 'האם יש חשש שהבוט בטעות ימחק דפים בלי כוונה?',
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  const result = await poll(thread, run);
  if (!result) {
    throw new Error('Failed to get result');
  }
  const messages = await openai.beta.threads.messages.list(thread.id);
  const reply = messages.data.find((msg) => msg.role === 'assistant');
  if (reply?.content[0].type === 'text') {
    console.log('💬 Bot says:', reply?.content[0].text.value);
  } else {
    throw new Error('Not supported reply type');
  }
}
