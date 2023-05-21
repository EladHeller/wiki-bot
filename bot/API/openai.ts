import 'dotenv/config';
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const prePrompt = `I will ask you about list of two names in Hebrew if they are the same person or not.
First name may be in format of wiki link.
Ignore letters of Nikud (ו and י). 
One word equal in the given name and the family name is enough.
Answer for with just one word: "Yes" or "Not"`;

export async function isTwoWordsIsTheSamePerson(
  nameFromWiki: string,
  name2: string,
): Promise<boolean> {
  const res = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: `${prePrompt}\nFirst name: "${nameFromWiki}", Second name: "${name2}".`,
    temperature: 0.3,
  });
  const isEqual = res.data.choices[0].text?.trim().replace(/["\n]/g, '') === 'Yes';
  console.log(`isTwoWordsIsTheSamePerson: ${nameFromWiki}, ${name2} ${isEqual}`);
  return isEqual;
}

export default {
  isTwoWordsIsTheSamePerson,
};
