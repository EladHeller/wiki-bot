import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export default async function* readSqlInsertValues(filePath: string): AsyncGenerator<string> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let fragments: string[] = [];
  let inString = false;
  let escapeNext = false;

  try {
    for await (const line of lines) {
      let start = 0;
      if (fragments.length > 0 || line.trimStart().startsWith('INSERT INTO ')) {
        for (let pos = 0; pos < line.length; pos += 1) {
          const char = line[pos];
          if (escapeNext) {
            escapeNext = false;
          } else if (char === '\\') {
            escapeNext = true;
          } else if (char === "'") {
            inString = !inString;
          } else if (char === ';' && !inString) {
            fragments.push(line.slice(start, pos));
            const statement = fragments.join('\n');
            const values = /\bVALUES\s+/.exec(statement);
            if (!values) throw new Error('SQL INSERT statement has no VALUES clause');
            yield statement.slice(values.index + values[0].length);
            fragments = [];
            start = pos + 1;
            if (!line.slice(start).trimStart().startsWith('INSERT INTO ')) {
              start = line.length;
              break;
            }
          }
        }

        if (start < line.length || fragments.length > 0) fragments.push(line.slice(start));
        escapeNext = false;
      }
    }

    if (fragments.length > 0) throw new Error('Unterminated SQL INSERT statement');
  } finally {
    lines.close();
    stream.destroy();
  }
}
