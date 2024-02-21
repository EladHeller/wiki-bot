import { getArguments } from '../decorators/getArguments';

describe('getArguments', () => {
  it('should parse args from function', () => {
    // eslint-disable-next-line no-multi-spaces, @typescript-eslint/no-unused-vars
    function a({ wikiApi, asdasd }, b: string,     c: number) {
    }

    expect(getArguments(a)).toStrictEqual([['wikiApi', 'asdasd'], 'b', 'c']);
  });

  it('should parse args from arrow function', () => {
    // eslint-disable-next-line no-multi-spaces, @typescript-eslint/no-unused-vars
    const a = ({ wikiApi, asdasd }, b: string, c: number) => {
    };

    expect(getArguments(a)).toStrictEqual([['wikiApi', 'asdasd'], 'b', 'c']);
  });

  it('should parse args with comments', () => {
    // eslint-disable-next-line no-multi-spaces, @typescript-eslint/no-unused-vars
    const a = (//
      // eslint-disable-next-line indent
// /* comment */
/* eslint-disable-next-line no-multi-spaces, @typescript-eslint/no-unused-vars */ // eslint-disable-line indent
      { wikiApi,  /* comment //  */  asdasd }, /* comment */
      /*
    eslint-disable-next-line no-multi-spaces, @typescript-eslint/no-unused-vars
    */
      b: string,
      // eslint-disable-next-line no-multi-spaces, @typescript-eslint/no-unused-vars, indent, spaced-comment, comma-spacing
         [,e, f,/*test*/     g]: number[], //
    /** */) => {
    };

    expect(getArguments(a)).toStrictEqual([['wikiApi', 'asdasd'], 'b', ['e', 'f', 'g']]);
  });

  it('should parse function without args', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const a = () => {
    };

    expect(getArguments(a)).toStrictEqual([]);
  });

  it('should parse empty destructure', () => {
    // eslint-disable-next-line no-multi-spaces, @typescript-eslint/no-unused-vars
    const a = ({}, b: string, []) => { // eslint-disable-line no-empty-pattern
    };

    expect(getArguments(a)).toStrictEqual([[], 'b', []]);
  });
});
