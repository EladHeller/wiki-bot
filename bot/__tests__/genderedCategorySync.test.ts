import { applyCategoryChanges, parseCategories } from '../maintenance/genderedCategorySync/model';

describe('genderedCategorySync helpers', () => {
  test('parseCategories parses Hebrew categories', () => {
    const content = 'text\n[[קטגוריה:בוגרות אוניברסיטת תל אביב]]\n[[קטגוריה:נולדו ב-1980]]';
    const categories = parseCategories(content);

    expect(categories.map((c) => c.name)).toEqual([
      'בוגרות אוניברסיטת תל אביב',
      'נולדו ב-1980',
    ]);
  });

  test('applyCategoryChanges adds missing sibling and keeps order rules', () => {
    const content = [
      'ערך',
      '[[קטגוריה:ישראלים]]',
      '[[קטגוריה:בוגרי אוניברסיטת תל אביב]]',
      '[[קטגוריה:נפטרו ב-2001]]',
      '[[קטגוריה:נולדו ב-1980]]',
      '',
    ].join('\n');

    const result = applyCategoryChanges(content, ['בוגרות אוניברסיטת תל אביב'], [
      {
        general: 'בוגרי אוניברסיטת תל אביב',
        feminine: 'בוגרות אוניברסיטת תל אביב',
        rule: 'manual:בוגרי/בוגרות',
        autoDetected: false,
      },
    ]);

    expect(result.changed).toBe(true);
    expect(result.content).toContain('[[קטגוריה:בוגרות אוניברסיטת תל אביב]]\n[[קטגוריה:בוגרי אוניברסיטת תל אביב]]');
    expect(result.content.indexOf('[[קטגוריה:נולדו ב-1980]]')).toBeLessThan(result.content.indexOf('[[קטגוריה:נפטרו ב-2001]]'));
  });

  test('applyCategoryChanges keeps unrelated category relative order', () => {
    const content = [
      'ערך',
      '[[קטגוריה:א]]',
      '[[קטגוריה:ב]]',
      '[[קטגוריה:ג]]',
      '',
    ].join('\n');

    const result = applyCategoryChanges(content, ['ד'], []);

    const categories = parseCategories(result.content).map((c) => c.name);
    expect(categories.slice(0, 3)).toEqual(['א', 'ב', 'ג']);
    expect(categories[3]).toBe('ד');
  });
});
