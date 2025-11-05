import {
  readdir, readFile, writeFile,
} from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);
const distDir = join(dirName, '..', 'dist');

async function* walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      yield fullPath;
    }
  }
}

function addJsExtensions(content) {
  // Replace relative imports without .js extension
  // Match: import ... from '../path' or import ... from './path'
  return content.replace(
    /from\s+['"](\.\.?\/[^'"]+)['"]/g,
    (match, importPath) => {
      // Don't add .js if it already has an extension
      if (importPath.match(/\.\w+$/)) {
        return match;
      }
      return `from "${importPath}.js"`;
    },
  );
}

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const updated = addJsExtensions(content, filePath);
  if (content !== updated) {
    await writeFile(filePath, updated, 'utf-8');
    console.log(`Updated: ${relative(distDir, filePath)}`);
  }
}

async function main() {
  for await (const filePath of walkDir(distDir)) {
    await processFile(filePath);
  }
  console.log('Done adding .js extensions');
}

main().catch(console.error);
