import { nextWikiText } from './WikiParser';

export type TableRow = {
  fields: (string | number | boolean)[];
  style?: string;
  isHeader?: boolean;
}

export type TableData = {
  text: string;
  rows: TableRow[];
  tableStyle: string;
}

function getNextRowDelimiterIndex(rowText, currIndex, delimiter) {
  const nextDelimiterIndex1 = nextWikiText(rowText, currIndex, delimiter + delimiter);
  const nextDelimiterIndex2 = nextWikiText(rowText, currIndex, `\n${delimiter}`);
  const index = ((nextDelimiterIndex2 === -1)
  || ((nextDelimiterIndex1 < nextDelimiterIndex2) && (nextDelimiterIndex1 > -1)))
    ? nextDelimiterIndex1
    : nextDelimiterIndex2;
  return index;
}

function getTableRow(rowText: string, isHeader: boolean): TableRow {
  const text = rowText.replace(/\n\s*\|}/g, '');
  const delimiter = isHeader ? '!' : '|';
  const row: TableRow = { fields: [], style: '' };
  let currIndex = 0;

  if (text[currIndex] === delimiter) {
    currIndex += 1;
  }

  let nextDelimiterIndex = nextWikiText(text, currIndex, delimiter);
  const textToTheNextDelimiter = text.substring(currIndex, nextDelimiterIndex);
  // Row has style cell
  if (text[nextDelimiterIndex + 1] !== delimiter && !textToTheNextDelimiter.includes('\n')) {
    row.style = text.substring(currIndex, nextDelimiterIndex).trim();
    currIndex = nextDelimiterIndex + 1;
  }

  nextDelimiterIndex = getNextRowDelimiterIndex(text, currIndex, delimiter);

  while (nextDelimiterIndex !== -1) {
    row.fields.push(text.substring(currIndex, nextDelimiterIndex).trim());
    currIndex = nextDelimiterIndex + 2;
    nextDelimiterIndex = getNextRowDelimiterIndex(text, currIndex, delimiter);
  }

  row.fields.push(text.substring(currIndex).trim());

  return row;
}

function findTablesText(articleContent: string): string[] {
  const startStr = '{|';
  const tables: string[] = [];

  let startIndex = articleContent.indexOf(startStr);
  let endIndex;
  while (startIndex > -1) {
    endIndex = nextWikiText(articleContent, startIndex + startStr.length, '|}') + 2;
    tables.push(articleContent.substring(startIndex, endIndex));
    startIndex = articleContent.indexOf(startStr, endIndex);
  }
  return tables;
}

function tableTextToObject(tableText: string): TableData {
  const startStr = '{|';
  const text = tableText;
  const tableData: TableData = { text, rows: [], tableStyle: '' };
  let rowText;
  const headerIndex = text.indexOf('!', startStr.length);
  const rowIndex = text.indexOf('|', startStr.length);
  const hasHeader = (headerIndex > -1) && (headerIndex < rowIndex);
  let currIndex = hasHeader ? headerIndex : rowIndex;
  tableData.tableStyle = text.substring(startStr.length, currIndex).trim();

  let nextRowIndex = nextWikiText(text, currIndex, '|-');

  if (hasHeader) {
    rowText = nextRowIndex === -1
      ? text.substring(currIndex + 1).trim()
      : text.substring(currIndex + 1, nextRowIndex).trim();
    tableData.rows.push(getTableRow(rowText, true));
    if (nextRowIndex === -1) {
      currIndex = text.indexOf(rowText) + rowText.length;
    } else {
      currIndex = nextRowIndex + 2;
    }
    nextRowIndex = nextWikiText(text, currIndex, '|-');
  }

  while (nextRowIndex > -1) {
    rowText = text.substring(currIndex + 1, nextRowIndex).trim();
    tableData.rows.push(getTableRow(rowText, false));
    nextRowIndex += 2;
    currIndex = nextRowIndex;
    nextRowIndex = nextWikiText(text, currIndex, '|-');
  }

  rowText = text.substring(currIndex + 1).trim();
  if (rowText) {
    tableData.rows.push(getTableRow(rowText, false));
  }

  return tableData;
}

export function buildTableRow(
  fields: (string | number | boolean | null)[],
  style?: string,
  isHeader = false,
): string {
  const delimiter = isHeader ? '!' : '|';
  let rowStr = `\n|-${style ?? ''}\n${delimiter}${fields[0]?.toString().replace(/\n/g, '')}`;
  for (let i = 1; i < fields.length; i += 1) {
    const field = fields[i];
    rowStr += ` || ${field == null ? '---' : field.toString().replace(/\n/g, '').trim()}`;
  }
  return rowStr;
}

export function buildTable(headers: string[], rows: string[][], sortable = true): string {
  return `{| class="wikitable${sortable ? ' sortable' : ''}"
! ${headers.join(' !! ')}
${rows.map((row) => buildTableRow(row)).join('')}\n|}`;
}

export function buildTableWithStyle(headers: string[], rows: TableRow[], sortable = true): string {
  const headersText = headers.join(' !! ');
  const rowsText = rows.map((row) => buildTableRow(row.fields, row.style, row.isHeader)).join('');
  return `{| class="wikitable${sortable ? ' sortable' : ''}"
! ${headersText}${rowsText}\n|}`;
}

export default function parseTableText(articleText: string): TableData[] {
  const tableTexts = findTablesText(articleText);

  return tableTexts.map(tableTextToObject);
}
