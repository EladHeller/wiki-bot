import { describe, expect, it } from '@jest/globals';
import {
  extractYearFromDate,
  getReleaseYearFromTemplate,
  removeCategoryLine,
  processSingleTemplate,
  processAlbumTemplate,
} from '../scripts/removeCategoriesFromSingleAlbum/model';

describe('extractYearFromDate', () => {
  it('should extract year from simple year string', () => {
    expect(extractYearFromDate('2024')).toBe('2024');
  });

  it('should extract year from linked year', () => {
    expect(extractYearFromDate('[[2024]]')).toBe('2024');
  });

  it('should extract year from full date', () => {
    expect(extractYearFromDate('23 בפברואר 2024')).toBe('2024');
  });

  it('should extract year from linked full date', () => {
    expect(extractYearFromDate('[[23 בפברואר]] [[2024]]')).toBe('2024');
  });

  it('should return null for invalid date', () => {
    expect(extractYearFromDate('')).toBeNull();
    expect(extractYearFromDate('invalid')).toBeNull();
  });
});

describe('getReleaseYearFromTemplate', () => {
  it('should extract year from template data', () => {
    const templateData = { 'יצא לאור': '2024' };

    expect(getReleaseYearFromTemplate(templateData)).toBe('2024');
  });

  it('should return null if no release date', () => {
    const templateData = {};

    expect(getReleaseYearFromTemplate(templateData)).toBeNull();
  });
});

describe('removeCategoryLine', () => {
  it('should remove category line', () => {
    const content = 'Some text\n[[קטגוריה:שירי 2024]]\nMore text';
    const result = removeCategoryLine(content, 'שירי 2024');

    expect(result).toBe('Some text\nMore text');
  });

  it('should remove multiple occurrences', () => {
    const content = '[[קטגוריה:שירי 2024]]\nText\n[[קטגוריה:שירי 2024]]';
    const result = removeCategoryLine(content, 'שירי 2024');

    expect(result).toBe('Text\n');
  });

  it('should not change content if category not found', () => {
    const content = 'Some text\n[[קטגוריה:אחר]]\nMore text';
    const result = removeCategoryLine(content, 'שירי 2024');

    expect(result).toBe(content);
  });
});

describe('processSingleTemplate', () => {
  it('should remove categories for single without type', () => {
    const templateData = {};
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).not.toContain('[[קטגוריה:סינגלים מ-2024]]');
  });

  it('should skip if ללא קטגוריה is כן', () => {
    const templateData = { 'ללא קטגוריה': 'כן' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).toBe(content);
  });

  it('should remove only songs category if type is not single', () => {
    const templateData = { סוג: 'אחר' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).toContain('[[קטגוריה:סינגלים מ-2024]]');
  });

  it('should remove both categories if type is סינגל', () => {
    const templateData = { סוג: 'סינגל' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).not.toContain('[[קטגוריה:סינגלים מ-2024]]');
  });

  it('should remove both categories if type is שיר אירוויזיון', () => {
    const templateData = { סוג: 'שיר אירוויזיון' };
    const content = 'Text\n[[קטגוריה:שירי 2024]]\n[[קטגוריה:סינגלים מ-2024]]\nMore';
    const result = processSingleTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:שירי 2024]]');
    expect(result).not.toContain('[[קטגוריה:סינגלים מ-2024]]');
  });
});

describe('processAlbumTemplate', () => {
  it('should remove albums category', () => {
    const templateData = {};
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
  });

  it('should skip if ללא קטגוריה is כן', () => {
    const templateData = { 'ללא קטגוריה': 'כן' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).toBe(content);
  });

  it('should remove EP category for EP type', () => {
    const templateData = { סוג: 'EP' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:מיני-אלבומים מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:מיני-אלבומים מ-2024]]');
  });

  it('should remove live album category for הופעה type', () => {
    const templateData = { סוג: 'הופעה' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי הופעה מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי הופעה מ-2024]]');
  });

  it('should remove compilation category for אוסף type', () => {
    const templateData = { סוג: 'אוסף' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:אלבומי אוסף מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:אלבומי אוסף מ-2024]]');
  });

  it('should remove soundtrack category for פסקול type', () => {
    const templateData = { סוג: 'פסקול' };
    const content = 'Text\n[[קטגוריה:אלבומי 2024]]\n[[קטגוריה:פסקולים מ-2024]]\nMore';
    const result = processAlbumTemplate(templateData, content, '2024');

    expect(result).not.toContain('[[קטגוריה:אלבומי 2024]]');
    expect(result).not.toContain('[[קטגוריה:פסקולים מ-2024]]');
  });
});
