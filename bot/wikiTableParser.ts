import { nextWikiText } from './WikiParser';

type TableRow = {
  values: string[];
  rowStyle: string;
}

type TableData = {
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
  const delimiter = isHeader ? '!' : '|';
  const row: TableRow = { values: [], rowStyle: '' };
  let currIndex = 0;

  if (rowText[currIndex] === delimiter) {
    currIndex += 1;
  }

  let nextDelimiterIndex = nextWikiText(rowText, currIndex, delimiter);

  // Row has style cell
  if (rowText[nextDelimiterIndex + 1] !== delimiter) {
    row.rowStyle = rowText.substring(currIndex, nextDelimiterIndex).trim();
    currIndex = nextDelimiterIndex + 1;
  }

  nextDelimiterIndex = getNextRowDelimiterIndex(rowText, currIndex, delimiter);

  while (nextDelimiterIndex !== -1) {
    row.values.push(rowText.substring(currIndex, nextDelimiterIndex).trim());
    currIndex = nextDelimiterIndex + 2;
    nextDelimiterIndex = getNextRowDelimiterIndex(rowText, currIndex, delimiter);
  }

  row.values.push(rowText.substring(currIndex).trim());

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
  const tableData: TableData = { text: tableText, rows: [], tableStyle: '' };
  let rowText;
  const headerIndex = tableText.indexOf('!', startStr.length);
  const rowIndex = tableText.indexOf('|', startStr.length);
  const hasHeader = (headerIndex > -1) && (headerIndex < rowIndex);
  let currIndex = hasHeader ? headerIndex : rowIndex;
  tableData.tableStyle = tableText.substring(startStr.length, currIndex).trim();
  let nextRowIndex = nextWikiText(tableText, currIndex, '|-');

  if (hasHeader) {
    rowText = tableText.substring(currIndex + 1, nextRowIndex).trim();
    tableData.rows.push(getTableRow(rowText, true));
    nextRowIndex += 2;
    currIndex = nextRowIndex;
    nextRowIndex = nextWikiText(tableText, currIndex, '|-');
  }

  while (nextRowIndex > -1) {
    rowText = tableText.substring(currIndex + 1, nextRowIndex).trim();
    tableData.rows.push(getTableRow(rowText, false));
    nextRowIndex += 2;
    currIndex = nextRowIndex;
    nextRowIndex = nextWikiText(tableText, currIndex, '|-');
  }

  rowText = tableText.substring(currIndex + 1).trim();
  tableData.rows.push(getTableRow(rowText, false));

  return tableData;
}

export default function parseTableText(articleText: string): TableData[] {
  const tableTexts = findTablesText(articleText);

  return tableTexts.map(tableTextToObject);
}
