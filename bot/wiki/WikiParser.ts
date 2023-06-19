const nowiki = '<nowiki>';
const nowikiEnd = '</nowiki>';

export function noWikiEndTagIndex(text: string, startIndex: number): number {
  return text.indexOf(nowikiEnd, startIndex) + nowikiEnd.length;
}

export function nextWikiText(text: string, currIndex: number, str: string): number {
  let index = currIndex;
  while (text.substring(index, index + str.length) !== str && index < text.length && index !== -1) {
    if (text.substring(index, index + nowiki.length) === nowiki) {
      index = noWikiEndTagIndex(text, index);
    } else if (text.substring(index, index + 2) === '{{') {
      index = nextWikiText(text, index + 2, '}}');
      if (index === -1) {
        console.warn('{{ without }}');
        return -1;
      }
      index += 2;
    } else if (text[index] === '{') {
      index = nextWikiText(text, index + 1, '}');
      if (index === -1) {
        console.warn('{ without }');
        return -1;
      }
      index += 1;
    } else if (text[index] === '[') {
      index = nextWikiText(text, index + 1, ']');
      if (index === -1) {
        console.warn('[ without ]');
        return -1;
      }
      index += 1;
    } else {
      index += 1;
    }
  }
  index = index < text.length ? index : -1;

  return index;
}

export function buildTableRow(
  fields: (string | number | boolean)[],
  style?: string,
  isHeader = false,
): string {
  const delimiter = isHeader ? '!' : '|';
  let rowStr = `\n|-${style ?? ''}\n${delimiter}${fields[0].toString().replace(/\n/g, '')}`;
  for (let i = 1; i < fields.length; i += 1) {
    rowStr += ` || ${fields[i] == null ? '---' : fields[i].toString().replace(/\n/g, '')}`;
  }
  return rowStr;
}

export function buildTable(headers: string[], rows: string[][]): string {
  return `{| class="wikitable sortable"
! ${headers.join(' !! ')}
${rows.map((row) => buildTableRow(row)).join('')}\n|}`;
}

export type TableRow = {
  fields: (string | number | boolean)[];
  style?: string;
  isHeader?: boolean;
}

export function buildTableWithStyle(headers: string[], rows: TableRow[]): string {
  return `{| class="wikitable sortable"
! ${headers.join(' !! ')}
${rows.map((row) => buildTableRow(row.fields, row.style, row.isHeader)).join('')}\n|}`;
}
