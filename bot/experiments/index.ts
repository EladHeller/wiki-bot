import 'dotenv/config';
import { chatWithTerminal } from '../API/openai';

async function main() {
  console.log(await chatWithTerminal('curl http://example.com'));
}

main();
