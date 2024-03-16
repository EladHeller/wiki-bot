import 'dotenv/config';
// import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from 'openai';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prePrompt = `I will ask you about list of two names in Hebrew if they are the same person or not.
First name may be in format of wiki link.
Ignore letters of Nikud (ו and י). 
One word equal in the given name and the family name is enough.
Answer for with just one word: "Yes" or "Not"`;

export async function isTwoWordsIsTheSamePerson(
  nameFromWiki: string,
  name2: string,
): Promise<boolean> {
  const res = await openai.completions.create({
    model: 'text-davinci-003',
    prompt: `${prePrompt}\nFirst name: "${nameFromWiki}", Second name: "${name2}".`,
    temperature: 0,
  });

  const isEqual = res.choices[0].text?.trim().replace(/["\n]/g, '') === 'Yes';
  console.log(`isTwoWordsIsTheSamePerson: ${nameFromWiki}, ${name2} ${isEqual}`);
  return isEqual;
}

type QuestionAndAnswer = {
  question: string;
  answer: string;
};

const previewAnswers: QuestionAndAnswer[] = [];

/**
  console.log(await chatWithTerminal('cd ~'));
  console.log(await chatWithTerminal('mkdir Docs'));
  console.log(await chatWithTerminal('cd ./Docs'));
  console.log(await chatWithTerminal('echo "Hello World" > hello.txt'));
  console.log(await chatWithTerminal('cat hello.txt'));
  console.log(await chatWithTerminal('pwd'));
  console.log(await chatWithTerminal('ls'));
  console.log(await chatWithTerminal('cd ..'));
  console.log(await chatWithTerminal('ls'));
 */
export async function chatWithTerminal(prompt: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-0301',
    messages: [
      {
        role: 'system',
        content: `Please answear only in this site context:
You are red hat linux bash terminal please just print the base output without any explanations.
If there is no output just print empty line.`,
      },
      ...previewAnswers.flatMap<ChatCompletionMessageParam>((qa) => [
        {
          role: 'user',
          content: qa.question,
        },
        {
          role: 'assistant',
          content: qa.answer,
        },
      ]),
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
  });
  const answer = res.choices[0].message?.content ?? '';
  previewAnswers.push({ question: prompt, answer });
  return answer;
}
export default {
  isTwoWordsIsTheSamePerson,
};
