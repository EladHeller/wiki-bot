/* eslint-disable jest/no-disabled-tests */
import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import { nextWikiText, parseWikiStructures } from '../wiki/WikiParser';

describe('parseWikiStructures', () => {
  it('should parse structures without startIndex (default parameter)', () => {
    const text = '{{template}} text';
    const structures = parseWikiStructures(text);

    expect(structures).toHaveLength(1);
    expect(structures[0].type).toBe('template');
    expect(structures[0].start).toBe(0);
    expect(structures[0].end).toBe(12);
  });

  it('should parse structures with startIndex', () => {
    const text = 'before {{template}} after';
    const structures = parseWikiStructures(text, 7);

    expect(structures).toHaveLength(1);
    expect(structures[0].type).toBe('template');
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

  it('should ignore text in <!-- -->', () => {
    const text = 'This is a <!--sample text with {{nested {{templates}}}}--> comment.';
    const currIndex = 0;
    const str = '{{nested {{templates}}}}';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it('should handle not closed <!-- tag', () => {
    const text = 'This is a <!--sample text with {{nested {{templates}}}} comment.';
    const currIndex = 0;
    const str = '{{nested {{templates}}}}';

    expect(nextWikiText(text, currIndex, str)).toBe(31);
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

  it('should ignore text in {{{ }}} parameters', () => {
    const text = 'This is a {{{param|default value}}} parameter.';
    const currIndex = 0;
    const str = 'default';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it('should find text after {{{ }}} parameters', () => {
    const text = 'Template {{{1}}} has text after';
    const currIndex = 0;
    const str = 'text';

    expect(nextWikiText(text, currIndex, str)).toBe(21);
  });

  it('should handle nested {{{ }}} parameters in templates', () => {
    const text = '{{template|param={{{1|default}}}}} after';
    const currIndex = 0;
    const str = 'after';

    expect(nextWikiText(text, currIndex, str)).toBe(35);
  });

  it('should handle unclosed </nowiki> tag', () => {
    const text = 'text </nowiki> more';
    const currIndex = 0;
    const str = 'more';

    expect(nextWikiText(text, currIndex, str)).toBe(15);
  });

  it('should handle unclosed --> comment end tag', () => {
    const text = 'text --> more';
    const currIndex = 0;
    const str = 'more';

    expect(nextWikiText(text, currIndex, str)).toBe(9);
  });

  it('should work with ignoreTemplates=true to find text inside templates', () => {
    const text = '{{template|inside}} outside';
    const currIndex = 0;
    const str = 'inside';

    expect(nextWikiText(text, currIndex, str, true)).toBe(11);
  });

  it('should skip text inside single bracket links [...]', () => {
    const text = 'before [http://example.com link text] after';
    const currIndex = 0;
    const str = 'link';

    expect(nextWikiText(text, currIndex, str)).toBe(-1);
  });

  it('should find text after single bracket links', () => {
    const text = 'before [http://example.com] after';
    const currIndex = 0;
    const str = 'after';

    expect(nextWikiText(text, currIndex, str)).toBe(28);
  });

  it('should handle closing ]] without opening [[', () => {
    const text = 'text ]] more text';
    const currIndex = 0;
    const str = 'more';

    expect(nextWikiText(text, currIndex, str)).toBe(8);
  });

  it('should handle closing ] without opening [', () => {
    const text = 'text ] more text';
    const currIndex = 0;
    const str = 'more';

    expect(nextWikiText(text, currIndex, str)).toBe(7);
  });
});

describe('warning logs for unclosed structures', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log warning for unclosed template when title is provided', () => {
    const text = 'text {{template|param more';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed template in "Test Article"'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('at position 5'),
    );
  });

  it('should log warning for unclosed nowiki when title is provided', () => {
    const text = 'text <nowiki>content';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed nowiki in "Test Article"'),
    );
  });

  it('should log warning for unclosed comment when title is provided', () => {
    const text = 'text <!--comment';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed comment in "Test Article"'),
    );
  });

  it('should log warning for unclosed parameter when title is provided', () => {
    const text = 'text {{{param';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed parameter in "Test Article"'),
    );
  });

  it('should log warning for unclosed wikilink when title is provided', () => {
    const text = 'text [[link';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed wikilink in "Test Article"'),
    );
  });

  it('should log warning for unclosed external link when title is provided', () => {
    const text = 'text [http://example.com';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed link in "Test Article"'),
    );
  });

  it('should log warning for unclosed single brace when title is provided', () => {
    const text = 'text {brace';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed brace in "Test Article"'),
    );
  });

  it('should log multiple warnings for multiple unclosed structures', () => {
    const text = '{{template [[link {{{param';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed template'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed wikilink'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Unclosed parameter'),
    );
    expect(consoleLogSpy).toHaveBeenCalledTimes(3);
  });

  it('should NOT log warning when structure is properly closed', () => {
    const text = 'text {{template|param}} more';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should NOT log warning when title is not provided', () => {
    const text = 'text {{template|param more';
    parseWikiStructures(text);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should NOT log warning when title is undefined', () => {
    const text = 'text {{template|param more';
    parseWikiStructures(text, 0, undefined);

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should include position and preview in warning message', () => {
    const text = 'prefix {{template|param|value unclosed text';
    parseWikiStructures(text, 0, 'Test Article');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/at position \d+: {{template\|param\|value unclosed text\.\.\./),
    );
  });

  it('should truncate preview to 100 characters', () => {
    const longText = 'x'.repeat(50);
    const text = `{{template|${longText}${longText}${longText}`;
    parseWikiStructures(text, 0, 'Test Article');

    const call = consoleLogSpy.mock.calls[0][0];
    const preview = call.split(': ')[1];

    expect(preview.length).toBeLessThanOrEqual(104);
  });

  it('should log O(n) warnings not O(2^n) - regression test for original bug', () => {
    // Original bug: with malformed {{{ the recursive algorithm created 2^n logs
    // Fixed: with stack-based algorithm we get exactly n logs (one per unclosed structure)
    const text = '{{{ text {{{ more {{{ end';
    parseWikiStructures(text, 0, 'Regression Test Article');

    expect(consoleLogSpy).toHaveBeenCalledTimes(3);

    expect(consoleLogSpy.mock.calls.every((call) => call[0].includes('Warning: Unclosed parameter'))).toBe(true);
    expect(consoleLogSpy.mock.calls.every((call) => call[0].includes('Regression Test Article'))).toBe(true);
  });

  it('regression: should handle large number of unclosed structures efficiently', () => {
    // Performance test: even with many unclosed structures, should be O(n) not O(2^n)
    const count = 650;
    const text = '{{{ '.repeat(count);
    const start = Date.now();
    parseWikiStructures(text, 0, 'Performance Test Article');
    const duration = Date.now() - start;

    expect(consoleLogSpy).toHaveBeenCalledTimes(count);

    expect(duration).toBeLessThan(100);
  });
});
