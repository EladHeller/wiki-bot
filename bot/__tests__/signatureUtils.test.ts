import {
  afterEach, beforeEach, describe, expect, it, jest,
} from '@jest/globals';
import {
  extractSignatureDates,
  extractLastSignatureDate,
  extractFirstSignatureDate,
  isInactiveForDays,
} from '../utilities/signatureUtils';

describe('signatureUtils', () => {
  const fakerTimers = jest.useFakeTimers();

  afterEach(() => {
    jest.setSystemTime(jest.getRealSystemTime());
  });

  describe('extractSignatureDates', () => {
    it('should extract single signature date', () => {
      const text = 'Some content 12:42, 1 בינואר 2025 (IDT) more content';
      const dates = extractSignatureDates(text);

      expect(dates).toHaveLength(1);
      expect(dates[0]).toStrictEqual(new Date(2025, 0, 1));
    });

    it('should extract multiple signature dates', () => {
      const text = `
        First: 10:00, 1 בינואר 2025 (IDT)
        Second: 12:00, 5 בפברואר 2025 (IDT)
        Third: 15:00, 10 במרץ 2025 (IDT)
      `;
      const dates = extractSignatureDates(text);

      expect(dates).toHaveLength(3);
      expect(dates[0]).toStrictEqual(new Date(2025, 0, 1));
      expect(dates[1]).toStrictEqual(new Date(2025, 1, 5));
      expect(dates[2]).toStrictEqual(new Date(2025, 2, 10));
    });

    it('should sort dates chronologically', () => {
      const text = `
        Latest: 15:00, 10 במרץ 2025 (IDT)
        Earliest: 10:00, 1 בינואר 2025 (IDT)
        Middle: 12:00, 5 בפברואר 2025 (IDT)
      `;
      const dates = extractSignatureDates(text);

      expect(dates).toHaveLength(3);
      expect(dates[0]).toStrictEqual(new Date(2025, 0, 1));
      expect(dates[1]).toStrictEqual(new Date(2025, 1, 5));
      expect(dates[2]).toStrictEqual(new Date(2025, 2, 10));
    });

    it('should return empty array when no signatures found', () => {
      const text = 'No signatures here';
      const dates = extractSignatureDates(text);

      expect(dates).toHaveLength(0);
    });

    it('should handle invalid month names', () => {
      const text = `
        Valid: 10:00, 1 בינואר 2025 (IDT)
        Invalid: 12:00, 5 בטעות 2025 (IDT)
        Valid: 15:00, 10 במרץ 2025 (IDT)
      `;
      const dates = extractSignatureDates(text);

      expect(dates).toHaveLength(2);
      expect(dates[0]).toStrictEqual(new Date(2025, 0, 1));
      expect(dates[1]).toStrictEqual(new Date(2025, 2, 10));
    });

    it.each([
      { month: 'ינואר', text: '10:00, 1 בינואר 2025 (IDT)', expected: new Date(2025, 0, 1) },
      { month: 'פברואר', text: '10:00, 1 בפברואר 2025 (IDT)', expected: new Date(2025, 1, 1) },
      { month: 'מרץ', text: '10:00, 1 במרץ 2025 (IDT)', expected: new Date(2025, 2, 1) },
      { month: 'אפריל', text: '10:00, 1 באפריל 2025 (IDT)', expected: new Date(2025, 3, 1) },
      { month: 'מאי', text: '10:00, 1 במאי 2025 (IDT)', expected: new Date(2025, 4, 1) },
      { month: 'יוני', text: '10:00, 1 ביוני 2025 (IDT)', expected: new Date(2025, 5, 1) },
      { month: 'יולי', text: '10:00, 1 ביולי 2025 (IDT)', expected: new Date(2025, 6, 1) },
      { month: 'אוגוסט', text: '10:00, 1 באוגוסט 2025 (IDT)', expected: new Date(2025, 7, 1) },
      { month: 'ספטמבר', text: '10:00, 1 בספטמבר 2025 (IDT)', expected: new Date(2025, 8, 1) },
      { month: 'אוקטובר', text: '10:00, 1 באוקטובר 2025 (IDT)', expected: new Date(2025, 9, 1) },
      { month: 'נובמבר', text: '10:00, 1 בנובמבר 2025 (IDT)', expected: new Date(2025, 10, 1) },
      { month: 'דצמבר', text: '10:00, 1 בדצמבר 2025 (IDT)', expected: new Date(2025, 11, 1) },
    ])('should handle Hebrew month name $month', ({ text, expected }) => {
      const dates = extractSignatureDates(text);

      expect(dates).toHaveLength(1);
      expect(dates[0]).toStrictEqual(expected);
    });
  });

  describe('extractLastSignatureDate', () => {
    it('should return last signature date', () => {
      const text = `
        First: 10:00, 1 בינואר 2025 (IDT)
        Second: 12:00, 5 בפברואר 2025 (IDT)
        Third: 15:00, 10 במרץ 2025 (IDT)
      `;
      const date = extractLastSignatureDate(text);

      expect(date).toStrictEqual(new Date(2025, 2, 10));
    });

    it('should return null when no signatures found', () => {
      const text = 'No signatures here';
      const date = extractLastSignatureDate(text);

      expect(date).toBeNull();
    });

    it('should work with single signature', () => {
      const text = 'Single: 12:42, 1 בינואר 2025 (IDT)';
      const date = extractLastSignatureDate(text);

      expect(date).toStrictEqual(new Date(2025, 0, 1));
    });
  });

  describe('extractFirstSignatureDate', () => {
    it('should return first signature date', () => {
      const text = `
        First: 10:00, 1 בינואר 2025 (IDT)
        Second: 12:00, 5 בפברואר 2025 (IDT)
        Third: 15:00, 10 במרץ 2025 (IDT)
      `;
      const date = extractFirstSignatureDate(text);

      expect(date).toStrictEqual(new Date(2025, 0, 1));
    });

    it('should return null when no signatures found', () => {
      const text = 'No signatures here';
      const date = extractFirstSignatureDate(text);

      expect(date).toBeNull();
    });

    it('should work with single signature', () => {
      const text = 'Single: 12:42, 1 בינואר 2025 (IDT)';
      const date = extractFirstSignatureDate(text);

      expect(date).toStrictEqual(new Date(2025, 0, 1));
    });

    it('should return first chronologically even if not first textually', () => {
      const text = `
        Latest: 15:00, 10 במרץ 2025 (IDT)
        Earliest: 10:00, 1 בינואר 2025 (IDT)
        Middle: 12:00, 5 בפברואר 2025 (IDT)
      `;
      const date = extractFirstSignatureDate(text);

      expect(date).toStrictEqual(new Date(2025, 0, 1));
    });
  });

  describe('isInactiveForDays', () => {
    beforeEach(() => {
      fakerTimers.setSystemTime(new Date('2025-02-01T00:00:00Z'));
    });

    it('should return true when inactive for exactly the threshold', () => {
      const lastActivity = new Date('2025-01-18T00:00:00Z'); // 14 days ago
      const result = isInactiveForDays(lastActivity, 14);

      expect(result).toBe(true);
    });

    it('should return true when inactive for more than threshold', () => {
      const lastActivity = new Date('2025-01-01T00:00:00Z'); // 31 days ago
      const result = isInactiveForDays(lastActivity, 14);

      expect(result).toBe(true);
    });

    it('should return false when inactive for less than threshold', () => {
      const lastActivity = new Date('2025-01-25T00:00:00Z'); // 7 days ago
      const result = isInactiveForDays(lastActivity, 14);

      expect(result).toBe(false);
    });

    it('should return false when activity is today', () => {
      const lastActivity = new Date('2025-02-01T00:00:00Z'); // today
      const result = isInactiveForDays(lastActivity, 14);

      expect(result).toBe(false);
    });

    it('should work with different thresholds', () => {
      const lastActivity = new Date('2025-01-25T00:00:00Z'); // 7 days ago

      expect(isInactiveForDays(lastActivity, 5)).toBe(true);
      expect(isInactiveForDays(lastActivity, 7)).toBe(true);
      expect(isInactiveForDays(lastActivity, 10)).toBe(false);
      expect(isInactiveForDays(lastActivity, 14)).toBe(false);
    });

    it('should handle fractional days correctly', () => {
      const lastActivity = new Date('2025-01-18T12:00:00Z'); // 13.5 days ago

      expect(isInactiveForDays(lastActivity, 13)).toBe(true);
      expect(isInactiveForDays(lastActivity, 14)).toBe(false);
    });
  });
});
