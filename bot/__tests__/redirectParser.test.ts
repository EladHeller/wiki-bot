import { describe, expect, it } from '@jest/globals';
import { getRedirectTargetFromContent, isRedirectContent } from '../wiki/redirectParser';

describe('getRedirectTargetFromContent', () => {
  it('extracts redirect target from Hebrew redirect', () => {
    const content = '#הפניה [[עב-ידיים]]';

    expect(getRedirectTargetFromContent(content)).toBe('עב-ידיים');
  });

  it('returns null for empty page content', () => {
    const content = ' \n ';

    expect(getRedirectTargetFromContent(content)).toBeNull();
  });

  it('extracts redirect target from English redirect', () => {
    const content = '#REDIRECT [[Handedness]]';

    expect(getRedirectTargetFromContent(content)).toBe('Handedness');
  });

  it('handles BOM and leading empty lines', () => {
    const content = '\uFEFF\n\n#הפניה [[ערך יעד]]';

    expect(getRedirectTargetFromContent(content)).toBe('ערך יעד');
  });

  it('returns null for non-redirect content', () => {
    const content = '== פתיח ==\nטקסט רגיל';

    expect(getRedirectTargetFromContent(content)).toBeNull();
  });

  it('returns null when redirect has no wikilink target', () => {
    const content = '#הפניה יעד-ללא-סוגריים';

    expect(getRedirectTargetFromContent(content)).toBeNull();
  });
});

describe('isRedirectContent', () => {
  it('returns true for redirect content', () => {
    expect(isRedirectContent('#הפניה [[עב-ידיים]]')).toBe(true);
  });

  it('returns false for non-redirect content', () => {
    expect(isRedirectContent('תוכן רגיל')).toBe(false);
  });
});
