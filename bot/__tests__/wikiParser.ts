/* eslint-disable jest/no-disabled-tests */
import { noWikiEndTagIndex, nextWikiText } from '../wiki/WikiParser';

describe('noWikiEndTagIndex', () => {
  it('should return the correct index of </nowiki> tag', () => {
    const text = 'This </nowiki> is a <nowiki>sample text </nowiki> with </nowiki> tags.';
    const startIndex = 32;

    expect(noWikiEndTagIndex(text, startIndex)).toBe(49);
  });

  it('should return -1 if </nowiki> tag is not found', () => {
    const text = 'This is a sample text without nowiki tags.';
    const startIndex = 0;

    expect(noWikiEndTagIndex(text, startIndex)).toBe(-1);
  });
});

describe('nextWikiText', () => {
  it.skip('should find the next occurrence of a given string', () => {
    const text = 'This is {{a}} sample {{text}} with [[templates]] and {{nested {{templates}}}}.';
    const currIndex = 0;
    const str = '{{text}}';

    expect(nextWikiText(text, currIndex, str)).toBe(19);
  });

  it('should return -1 if the given string is not found', () => {
    const text = 'This is a sample text without the desired string.';
    const currIndex = 0;
    const str = '{{missing}}';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it.skip('should handle nested templates', () => {
    const text = 'This is {{a {{nested}} template}} with {{multiple {{nested}} templates}}.';
    const currIndex = 0;
    const str = '{{multiple {{nested}} templates}}';

    expect(nextWikiText(text, currIndex, str)).toBe(30);
  });

  it('should return -1 if a template is not closed', () => {
    const text = 'This is {{an unclosed template with no closing braces.';
    const currIndex = 0;
    const str = '{{unclosed}}';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });
});
