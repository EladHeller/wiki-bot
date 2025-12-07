interface WikiStructure {
  type: 'template' | 'parameter' | 'brace' | 'link' | 'wikilink' | 'nowiki' | 'comment';
  start: number;
  end: number;
}

function findLastInStack<T extends { type: string }>(stack: T[], type: string): number {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].type === type) {
      return i;
    }
  }
  return -1;
}

export function parseWikiStructures(text: string, startIndex?: number, title?: string): WikiStructure[] {
  const actualStartIndex = startIndex ?? 0;
  const structures: WikiStructure[] = [];
  const stack: Array<{ type: WikiStructure['type']; start: number }> = [];

  let i = actualStartIndex;
  while (i < text.length) {
    // Check for opening tags (longest first to avoid partial matches)
    if (text.substring(i, i + 8) === '<nowiki>') {
      stack.push({ type: 'nowiki', start: i });
      i += 8;
    } else if (text.substring(i, i + 4) === '<!--') {
      stack.push({ type: 'comment', start: i });
      i += 4;
    } else if (text.substring(i, i + 3) === '{{{') {
      stack.push({ type: 'parameter', start: i });
      i += 3;
    } else if (text.substring(i, i + 2) === '{{') {
      stack.push({ type: 'template', start: i });
      i += 2;
    } else if (text[i] === '{') {
      // Single brace - track it to maintain backward compatibility
      stack.push({ type: 'brace', start: i });
      i += 1;
    } else if (text.substring(i, i + 2) === '[[') {
      stack.push({ type: 'wikilink', start: i });
      i += 2;
    } else if (text[i] === '[') {
      stack.push({ type: 'link', start: i });
      i += 1;
    } else if (text.substring(i, i + 9) === '</nowiki>') {
      // Check for closing tags
      const lastNowiki = findLastInStack(stack, 'nowiki');
      if (lastNowiki !== -1) {
        const item = stack.splice(lastNowiki, 1)[0];
        structures.push({ type: 'nowiki', start: item.start, end: i + 9 });
      }
      i += 9;
    } else if (text.substring(i, i + 3) === '-->') {
      const lastComment = findLastInStack(stack, 'comment');
      if (lastComment !== -1) {
        const item = stack.splice(lastComment, 1)[0];
        structures.push({ type: 'comment', start: item.start, end: i + 3 });
      }
      i += 3;
    } else if (text[i] === '}') {
      // For closing braces, check what's on the stack to determine how many to consume
      // Priority: }}} for parameter, }} for template, } for single brace
      let matched = false;

      if (text.substring(i, i + 3) === '}}}') {
        const lastParam = findLastInStack(stack, 'parameter');
        if (lastParam !== -1) {
          const item = stack.splice(lastParam, 1)[0];
          structures.push({ type: 'parameter', start: item.start, end: i + 3 });
          i += 3;
          matched = true;
        }
      }

      if (!matched && text.substring(i, i + 2) === '}}') {
        const lastTemplate = findLastInStack(stack, 'template');
        if (lastTemplate !== -1) {
          const item = stack.splice(lastTemplate, 1)[0];
          structures.push({ type: 'template', start: item.start, end: i + 2 });
          i += 2;
          matched = true;
        }
      }

      if (!matched) {
        const lastBrace = findLastInStack(stack, 'brace');
        if (lastBrace !== -1) {
          const item = stack.splice(lastBrace, 1)[0];
          structures.push({ type: 'brace', start: item.start, end: i + 1 });
        }
        i += 1;
      }
    } else if (text.substring(i, i + 2) === ']]') {
      const lastWikilink = findLastInStack(stack, 'wikilink');
      if (lastWikilink !== -1) {
        const item = stack.splice(lastWikilink, 1)[0];
        structures.push({ type: 'wikilink', start: item.start, end: i + 2 });
      }
      i += 2;
    } else if (text[i] === ']') {
      const lastLink = findLastInStack(stack, 'link');
      if (lastLink !== -1) {
        const item = stack.splice(lastLink, 1)[0];
        structures.push({ type: 'link', start: item.start, end: i + 1 });
      }
      i += 1;
    } else {
      i += 1;
    }
  }

  // Log unclosed structures
  if (stack.length > 0 && title) {
    stack.forEach((unclosed) => {
      const preview = text.substring(unclosed.start, Math.min(unclosed.start + 100, text.length));
      console.log(`Warning: Unclosed ${unclosed.type} in "${title}" at position ${unclosed.start}: ${preview}...`);
    });
  }

  return structures.sort((a, b) => a.start - b.start);
}

function findStructureAtIndex(
  structures: WikiStructure[],
  currentIndex: number,
  ignoreTemplates?: boolean,
): WikiStructure | undefined {
  return structures.find((s) => currentIndex > s.start && currentIndex < s.end
    && (s.type === 'nowiki' || s.type === 'comment'
     || (!ignoreTemplates && (s.type === 'template' || s.type === 'parameter' || s.type === 'brace'
        || s.type === 'wikilink' || s.type === 'link'))));
}

export function nextWikiText(
  text: string,
  currIndex: number,
  str: string,
  ignoreTemplates?: boolean,
  title?: string,
): number {
  const structures = parseWikiStructures(text, currIndex, title);

  let index = currIndex;
  while (index < text.length) {
    const insideStructure = findStructureAtIndex(structures, index, ignoreTemplates);

    if (insideStructure) {
      index = insideStructure.end;
    } else {
      if (text.substring(index, index + str.length) === str) {
        return index;
      }
      index += 1;
    }
  }

  return -1;
}
