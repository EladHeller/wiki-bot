const nowiki = '<nowiki>';
const nowikiEnd = '</nowiki>';
const comment = '<!--';
const commentEnd = '-->';

export function noWikiEndTagIndex(text: string, startIndex: number): number {
  const nextNoWikiEndIndex = text.indexOf(nowikiEnd, startIndex);
  if (nextNoWikiEndIndex === -1) {
    return -1;
  }

  return nextNoWikiEndIndex + nowikiEnd.length;
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
      const before = index;
      index = noWikiEndTagIndex(text, index);
      if (index === -1) {
        console.warn('<nowiki> without </nowiki>', title, console.log(text.substring(before, before + 100)));
        index = before + nowiki.length;
      }
    } else if (text.substring(index, index + comment.length) === comment) {
      const before = index;
      index = text.indexOf(commentEnd, index);
      if (index === -1) {
        console.warn('<!-- without -->', title, console.log(text.substring(before, before + 100)));
        index = before + comment.length;
      } else {
        index += commentEnd.length;
      }
    } else if (text.substring(index, index + 2) === '{{' && !ignoreTemplates) {
      const before = index;
      index = nextWikiText(text, index + 2, '}}');
      if (index === -1) {
        console.warn('"{{" without "}}"', title, console.log(text.substring(before, before + 100)));
        index = before;
      }
      index += 2;
    } else if (text[index] === '{' && !ignoreTemplates) {
      const before = index;
      index = nextWikiText(text, index + 1, '}');
      if (index === -1) {
        console.warn('"{" without "}"', title, console.log(text.substring(before, before + 100)));
        index = before;
      }
      index += 1;
    } else if (text[index] === '[') {
      const before = index;
      index = nextWikiText(text, index + 1, ']');
      if (index === -1) {
        console.warn('"[" without "]"', title, console.log(text.substring(before, before + 100)));
        index = before;
      }
      index += 1;
    } else {
      index += 1;
    }
  }
  index = index < text.length ? index : -1;

  return index;
}
