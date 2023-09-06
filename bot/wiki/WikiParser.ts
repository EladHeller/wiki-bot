const nowiki = '<nowiki>';
const nowikiEnd = '</nowiki>';

export function noWikiEndTagIndex(text: string, startIndex: number): number {
  return text.indexOf(nowikiEnd, startIndex) + nowikiEnd.length;
}

export function nextWikiText(
  text: string,
  currIndex: number,
  str: string,
  ignoreTemplates?: boolean,
  title?: string,
): number {
  let index = currIndex;
  while (text.substring(index, index + str.length) !== str && index < text.length && index !== -1) {
    if (text.substring(index, index + nowiki.length) === nowiki) {
      index = noWikiEndTagIndex(text, index);
    } else if (text.substring(index, index + 2) === '{{' && !ignoreTemplates) {
      const before = index;
      index = nextWikiText(text, index + 2, '}}');
      if (index === -1) {
        console.warn('"{{" without "}}"', title, console.log(text.substring(before, before + 100)));
        return -1;
      }
      index += 2;
    } else if (text[index] === '{' && !ignoreTemplates) {
      const before = index;
      index = nextWikiText(text, index + 1, '}');
      if (index === -1) {
        console.warn('"{" without "}"', title, console.log(text.substring(before, before + 100)));
        return -1;
      }
      index += 1;
    } else if (text[index] === '[') {
      const before = index;
      index = nextWikiText(text, index + 1, ']');
      if (index === -1) {
        console.warn('"[" without "]"', title, console.log(text.substring(before, before + 100)));
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
