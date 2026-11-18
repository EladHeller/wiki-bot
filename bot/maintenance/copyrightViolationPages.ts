const copyrightViolationPages = {
  new: 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים',
  edit: 'ויקיפדיה:בוט/בדיקת הפרת זכויות יוצרים/עריכות',
} as const;

export const copyrightEditThreshold = 2000;
export const extraCopyrightResultsPage = (title: string) => `${title}/לוג`;

export default copyrightViolationPages;
