import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const deploymentFiles = [
  '../build/t01.cf.yaml',
  '../build/t02.cf.yaml',
  '../build/wiki-bot-playwright/Dockerfile',
];

process.env.BASE_URL ??= 'https://he.wikipedia.org';
process.env.BOT_NAME ??= 'Sapper-bot';
process.env.OPENAI_API_KEY ??= 'smoke-test';
process.env.VECTOR_STORE_ID ??= 'smoke-test';

async function getEntryPoints() {
  const contents = await Promise.all(deploymentFiles.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
  const handlers = contents.flatMap((content) => [...content.matchAll(/\b(dist\/[A-Za-z0-9/_-]+)\.main\b/g)]
    .map((match) => match[1]));

  return [...new Set(handlers)].map((handler) => `../${handler}.js`);
}

async function runSmokeTest() {
  console.log('Starting production dependency smoke test...');

  const dom = new JSDOM('<!DOCTYPE html><p>Hello</p>');
  if (dom.window.document.querySelector('p')?.textContent !== 'Hello') {
    throw new Error('JSDOM basic functionality failed');
  }
  console.log('JSDOM basic check passed');

  const entryPoints = await getEntryPoints();
  for (const entry of entryPoints) {
    const module = await import(entry);
    if (typeof module.main !== 'function') {
      throw new Error(`${entry} does not export a main function`);
    }
    console.log(`Imported ${entry}`);
  }

  console.log('All production entry points imported successfully');
}

runSmokeTest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
