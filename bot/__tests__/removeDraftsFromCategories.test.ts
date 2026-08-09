import { describe, expect, it } from '@jest/globals';
import removeArticleCategories from '../maintenance/removeDraftsFromCategories/removeArticleCategories';

describe('removeArticleCategories', () => {
  it('should remove all article categories and preserve maintenance categories', () => {
    const content = [
      'Draft content',
      '[[קטגוריה:קטגוריה ראשונה]]',
      '[[קטגוריה:ויקיפדיה:תחזוקה]]',
      '[[קטגוריה:קטגוריה שנייה|מיון]]',
    ].join('\n');

    const result = removeArticleCategories(content);

    expect(result).toBe([
      'Draft content',
      '[[:קטגוריה:קטגוריה ראשונה]]',
      '[[קטגוריה:ויקיפדיה:תחזוקה]]',
      '[[:קטגוריה:קטגוריה שנייה|מיון]]',
    ].join('\n'));
  });
});
