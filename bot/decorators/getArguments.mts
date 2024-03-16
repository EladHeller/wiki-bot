// https://github.com/microsoft/playwright/blob/ba72f7e429e5303707cec5e4d879d3d34cb4613d/packages/playwright/src/common/fixtures.ts

export function filterOutComments(s: string): string {
  const result: string[] = [];
  let commentState: 'none'|'singleline'|'multiline' = 'none';
  for (let i = 0; i < s.length; i += 1) {
    if (commentState === 'singleline') {
      if (s[i] === '\n') commentState = 'none';
    } else if (commentState === 'multiline') {
      if (s[i - 1] === '*' && s[i] === '/') commentState = 'none';
    } else if (s[i] === '/' && s[i + 1] === '/') { // commentState === 'none'
      commentState = 'singleline';
    } else if (s[i] === '/' && s[i + 1] === '*') {
      commentState = 'multiline';
      i += 2;
    } else {
      result.push(s[i]);
    }
  }
  return result.join('');
}

function splitByComma(s: string) {
  const result: string[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '{' || s[i] === '[') {
      stack.push(s[i] === '{' ? '}' : ']');
    } else if (s[i] === stack[stack.length - 1]) {
      stack.pop();
    } else if (!stack.length && s[i] === ',') {
      const token = s.substring(start, i).trim();
      if (token) result.push(token);
      start = i + 1;
    }
  }
  const lastToken = s.substring(start).trim();
  if (lastToken) result.push(lastToken);
  return result;
}
export function getArguments(cb: (...args: any[]) => any): Array<string|string[]> {
  const functionString = filterOutComments(cb.toString());
  const functionArgs = functionString.substring(functionString.indexOf('(') + 1, functionString.indexOf(')'));
  const splitted = splitByComma(functionArgs);
  return splitted.map((arg) => {
    if (arg.startsWith('{') || arg.startsWith('[')) {
      return splitByComma(arg.substring(1, arg.length - 1));
    }
    return arg;
  });
}
