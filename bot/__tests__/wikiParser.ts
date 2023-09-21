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
  it('should return -1 if the given string is not found', () => {
    const text = 'This is a sample text without the desired string.';
    const currIndex = 0;
    const str = '{{missing}}';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it('should return -1 if a template is not closed', () => {
    const text = 'This is {{an unclosed template with no closing braces.';
    const currIndex = 0;
    const str = '{{unclosed}}';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it('should ignore text in nowiki tags', () => {
    const text = 'This is a <nowiki>sample text with {{nested {{templates}}}}</nowiki> nowiki tags.';
    const currIndex = 0;
    const str = '{{nested {{templates}}}}';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it('should handle not closed nowiki tag', () => {
    const text = 'This is a <nowiki>sample text with {{nested {{templates}}}} nowiki tags.';
    const currIndex = 0;
    const str = '{{nested {{templates}}}}';

    expect(nextWikiText(text, currIndex, str)).toBe(35);
  });

  it('should ignore text in { }', () => {
    const text = 'This is a {sample text with {{nested {{templates}}}}} braces.';
    const currIndex = 0;
    const str = '{{nested {{templates}}}}';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it('should handle { without }', () => {
    const text = 'This is a {sample text with {{nested {{templates}}}} braces.';
    const currIndex = 0;
    const str = '{{nested {{templates}}}}';

    expect(nextWikiText(text, currIndex, str)).toBe(28);
  });

  it('should handle [ without ]', () => {
    const text = 'This is a [sample text with {{nested {{templates}}}} braces.';
    const currIndex = 0;
    const str = '{{nested {{templates}}}}';

    expect(nextWikiText(text, currIndex, str)).toBe(28);
  });
});
