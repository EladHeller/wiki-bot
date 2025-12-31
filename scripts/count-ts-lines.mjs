import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
// node scripts/count-ts-lines.mjs .
const IGNORE_DIRS = ['node_modules', 'dist', 'coverage', '.git'];
// , 'scripts', 'xmlbot', '__tests__'

const countLinesInFile = async (filePath) => {
  const content = await readFile(filePath, 'utf-8');
  return content.split('\n').length;
};

const walkDir = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = await Promise.all(
    entries
      .filter((entry) => !IGNORE_DIRS.includes(entry.name))
      .map(async (entry) => {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          return walkDir(fullPath);
        }
        if (extname(entry.name) === '.ts') {
          const lines = await countLinesInFile(fullPath);
          return { path: fullPath, lines };
        }
        return null;
      }),
  );
  return results.flat().filter(Boolean);
};

const main = async () => {
  const projectRoot = process.argv[2] || '.';
  const files = await walkDir(projectRoot);

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  const sortedByLines = [...files].sort((a, b) => b.lines - a.lines);

  console.log('📊 TypeScript Lines Count\n');
  console.log(`Total files: ${files.length}`);
  console.log(`Total lines: ${totalLines.toLocaleString()}\n`);

  console.log('Top 10 largest files:');
  sortedByLines.slice(0, 10).forEach((f, i) => {
    const relativePath = f.path.replace(`${projectRoot}/`, '');
    console.log(`  ${i + 1}. ${relativePath}: ${f.lines.toLocaleString()} lines`);
  });
};

main().catch(console.error);
