import { describe, expect, it } from '@jest/globals';
import formalizedDateFormat from '../utilities/formalizedDateFormat';

describe('formalizedDateFormat', () => {
  describe('format with additions', () => {
    it('should format date with wiki links', () => {
      expect(formalizedDateFormat('12 ב[[ינואר]] [[2023]]', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('12 ב[[ינואר]], [[2023]]', 'test')).toBe('12 בינואר 2023');
    });

    it('should format date with quotes', () => {
      expect(formalizedDateFormat("12 בינואר '''2023'''", 'test')).toBe('12 בינואר 2023');
    });

    it('should format date with variations', () => {
      expect(formalizedDateFormat('12 בינואר, 2023', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('12 בינואר, 2023.', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('12 ינואר 2023.', 'test')).toBe('12 בינואר 2023');
    });

    it('should return exact date if date is already in correct format', () => {
      expect(formalizedDateFormat('12 בינואר 2023', 'test')).toBe('12 בינואר 2023');
    });

    it('should format reversed Hebrew month date', () => {
      expect(formalizedDateFormat('ינואר 12, 2023', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('ינואר 12 2023', 'test')).toBe('12 בינואר 2023');
    });
  });

  describe('short year format', () => {
    it('should expand short year to full year', () => {
      expect(formalizedDateFormat('12 בינואר, 23', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('12 בינואר, 99', 'test')).toBe('12 בינואר 1999');
    });
  });

  describe('numeric date formats', () => {
    it('should format day/month/year', () => {
      expect(formalizedDateFormat('12/01/2023', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('12.01.2023', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('12-01-2023', 'test')).toBe('12 בינואר 2023');
    });

    it('should format date with time', () => {
      expect(formalizedDateFormat('12:00, 12/01/2023', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('(12:00, 12/01/2023)', 'test')).toBe('12 בינואר 2023');
    });

    it('should format year/month/day', () => {
      expect(formalizedDateFormat('2023/01/12', 'test')).toBe('12 בינואר 2023');
      expect(formalizedDateFormat('2023.01.12', 'test')).toBe('12 בינואר 2023');
    });
  });

  describe('invalid formats', () => {
    it('should return null for invalid date format', () => {
      expect(formalizedDateFormat('invalid date', 'test')).toBeNull();
      expect(formalizedDateFormat('', 'test')).toBeNull();
    });

    it('should return null for invalid day/month combinations', () => {
      expect(formalizedDateFormat('32/01/2023', 'test')).toBeNull();
      expect(formalizedDateFormat('12/13/2023', 'test')).toBeNull();
    });
  });
});
