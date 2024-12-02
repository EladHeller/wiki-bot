import { describe, expect, it } from '@jest/globals';
import getTalkPageTitle from '../wiki/getTalkPage';

describe('getTalkPageTitle function', () => {
  it('should return null if title is empty', () => {
    expect(getTalkPageTitle('')).toBeNull();
  });

  it('should return title unchanged if namespace is already "שיחה:" or "שיחת <namespace>"', () => {
    expect(getTalkPageTitle('שיחה:Example')).toBe('שיחה:Example');
    expect(getTalkPageTitle('שיחת משתמש:Example')).toBe('שיחת משתמש:Example');
  });

  it('should prepend "שיחה:" if the namespace is not recognized', () => {
    expect(getTalkPageTitle('Random:Example')).toBe('שיחה:Random:Example');
  });

  it('should prepend "שיחה:" if there is no namespace', () => {
    expect(getTalkPageTitle('Example')).toBe('שיחה:Example');
  });

  it('should prepend "שיחת <namespace>" if recognized namespace', () => {
    expect(getTalkPageTitle('קטגוריה:Example')).toBe('שיחת קטגוריה:Example');
  });

  it('should handle namespaces with special characters properly', () => {
    expect(getTalkPageTitle("גאדג'ט:Example")).toBe("שיחת גאדג'ט:Example");
    expect(getTalkPageTitle("הגדרת גאדג'ט:Example")).toBe("שיחת הגדרת גאדג'ט:Example");
  });

  it('should return null if unable to determine talk page title', () => {
    expect(getTalkPageTitle('מדיה:Example')).toBeNull();
    expect(getTalkPageTitle('נושא:Example')).toBeNull();
  });
});
