const nowiki = '<nowiki>';
const nowikiEnd = '</nowiki>';

export function noWikiEndTagIndex(text: string, startIndex: number): number {
  return text.indexOf(nowikiEnd, startIndex) + nowikiEnd.length;
}

export function nextWikiText(text: string, currIndex: number, str: string): number {
  let index = currIndex;
  while (text.substring(index, index + str.length) !== str && index < text.length) {
    if (text.substring(index, index + nowiki.length) === nowiki) {
      index = noWikiEndTagIndex(text, index);
    } else if (text.substring(index, index + 2) === '{{') {
      index = nextWikiText(text, index + 2, '}}') + 2;
    } else if (text[index] === '{') {
      index = nextWikiText(text, index + 1, '}') + 1;
    } else if (text[index] === '[') {
      index = nextWikiText(text, index + 1, ']') + 1;
    } else {
      index += 1;
    }
  }
  index = index < text.length ? index : -1;

  return index;
}

export function buildTableRow(fields: string[], style?: string, isHeader = false): string {
  const delimiter = isHeader ? '!' : '|';
  const styleWithDelimiter = style ? (style + delimiter) : '';
  let rowStr = `\n|-\n${delimiter}${styleWithDelimiter}${fields[0].replace(/\n/g, '')}`;
  for (let i = 1; i < fields.length; i += 1) {
    rowStr += ` || ${fields[i] === undefined ? '---' : fields[i].replace(/\n/g, '')}`;
  }
  return rowStr;
}

export function buildTable(headers: string[], rows: string[][]): string {
  return `{| class="wikitable sortable"
! ${headers.join(' !! ')}
${rows.map((row) => buildTableRow(row)).join('')}\n|}`;
}
