import {
  afterEach, beforeEach, describe, expect, it,
} from '@jest/globals';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import readSqlInsertValues from '../maintenance/removeDraftsFromCategories/readSqlInsertValues';

describe('readSqlInsertValues', () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sql-insert-test-'));
    filePath = join(directory, 'dump.sql');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function parse(sql: string): Promise<string[]> {
    await writeFile(filePath, sql);
    const values: string[] = [];
    for await (const value of readSqlInsertValues(filePath)) values.push(value);
    return values;
  }

  it('reads the original single-line dump format and ignores dump metadata', async () => {
    const result = await parse([
      '-- Dump header with an apostrophe: it\'s metadata',
      'CREATE TABLE `linktarget` (`lt_id` int);',
      "INSERT INTO `linktarget` VALUES (1,14,'Root'),(2,0,'Page');",
      '/*!40000 ALTER TABLE `linktarget` ENABLE KEYS */;',
      '',
    ].join('\n'));

    expect(result).toStrictEqual(["(1,14,'Root'),(2,0,'Page')"]);
  });

  it('reads VALUES followed by a newline and one row per line', async () => {
    const result = await parse([
      'INSERT INTO `linktarget` VALUES',
      "(1,14,'Root'),",
      "(2,0,'Page');",
      'INSERT INTO `linktarget` VALUES',
      "(3,14,'Other');",
    ].join('\n'));

    expect(result).toStrictEqual(["(1,14,'Root'),\n(2,0,'Page')", "(3,14,'Other')"]);
  });

  it('accepts CRLF, tabs, indentation and a split INSERT header', async () => {
    const result = await parse("  INSERT INTO `linktarget`\r\nVALUES\t(1,14,'Root');  ");

    expect(result).toStrictEqual(["(1,14,'Root')"]);
  });

  it('reads multiple statements on one line', async () => {
    const result = await parse('INSERT INTO `t` VALUES (1); INSERT INTO `t` VALUES (2);');

    expect(result).toStrictEqual(['(1)', '(2)']);
  });

  it('preserves delimiters, escaped quotes and escaped backslashes in strings', async () => {
    const values = String.raw`(1,'semi;colon, (parentheses)'),(2,'it\'s; here'),(3,'slash\\');`;
    const result = await parse(`INSERT INTO \`t\` VALUES ${values}`);

    expect(result).toStrictEqual([values.slice(0, -1)]);
  });

  it('preserves multiline strings including blank lines and escaped newlines', async () => {
    const values = "(1,'first\\\n\n;last')";
    const result = await parse(`INSERT INTO \`t\` VALUES ${values};`);

    expect(result).toStrictEqual([values]);
  });

  it('reads a large multiline statement', async () => {
    const values = Array.from({ length: 20000 }, (_, i) => `(${i},14,'Category_${i}')`).join(',\n');
    const result = await parse(`INSERT INTO \`linktarget\` VALUES\n${values};`);

    expect(result).toStrictEqual([values]);
  });

  it('returns no statements for an empty file', async () => {
    await expect(parse('')).resolves.toStrictEqual([]);
  });

  it('rejects incomplete statements', async () => {
    await expect(parse("INSERT INTO `t` VALUES\n(1,'unfinished")).rejects.toThrow('Unterminated SQL INSERT statement');
  });

  it('rejects unsupported INSERT statements', async () => {
    await expect(parse('INSERT INTO `t` SELECT * FROM `other`;')).rejects.toThrow('SQL INSERT statement has no VALUES clause');
  });

  it('closes the reader when iteration stops early', async () => {
    await writeFile(filePath, 'INSERT INTO `t` VALUES (1);\nINSERT INTO `t` VALUES (2);');
    const reader = readSqlInsertValues(filePath);

    await expect(reader.next()).resolves.toStrictEqual({ value: '(1)', done: false });
    await expect(reader.return(undefined)).resolves.toStrictEqual({ value: undefined, done: true });
  });
});
