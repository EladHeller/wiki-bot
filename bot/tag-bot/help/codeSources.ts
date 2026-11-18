import copyrightViolationPages from '../../maintenance/copyrightViolationPages';
import sportsReportPage from '../../sportPersonalityTemplatesYearsFormat/reportPage';

const sources = [
  {
    path: 'bot/sportPersonalityTemplatesYearsFormat/model.ts',
    label: 'כדורסלנים כדורגלנים תבניות אישיות ספורט פורמט שנים וטווחי תאריכים',
    reference: sportsReportPage,
  },
  {
    path: 'bot/maintenance/copyrightViolationCore.ts',
    label: 'הפרת זכויות יוצרים Copyvios בדיקות עריכות חדשות סף גודל ולוג',
    reference: copyrightViolationPages.new,
  },
  {
    path: 'bot/maintenance/copyrightViolationPages.ts',
    label: 'הפרת זכויות יוצרים כתובת הלוג וסף בתים בעריכות',
    reference: copyrightViolationPages.new,
  },
  {
    path: 'bot/maintenance/copyrightViolationEdit.ts',
    label: 'בוט בדיקת הפרת זכויות יוצרים בעריכות קיימות ודף התוצאות',
    reference: copyrightViolationPages.edit,
  },
  {
    path: 'bot/maintenance/languageLinks.ts',
    label: 'בוט תיקון קישורי שפה לוויקיפדיה זרה',
    reference: 'ויקיפדיה:בוט/קישורי שפה',
  },
  {
    path: 'bot/maintenance/userTalkArchiveBot/UserTalkArchiveBotModel.ts',
    label: 'ארכוב אוטומטי של דפי שיחה תיבת ארכיון והגדרות',
    reference: 'ויקיפדיה:בוט/בוט ארכוב אוטומטי',
  },
  {
    path: 'bot/maintenance/closedDiscussionsArchiveBot/ClosedDiscussionsArchiveBotModel.ts',
    label: 'ארכוב דיונים לפי מצב יעדים ומחיקה',
    reference: 'ויקיפדיה:בוט/ארכוב דיונים',
  },
  {
    path: 'bot/recordCharts/MediaForestModel.ts',
    label: 'בוט מצעדים מדיה פורסט המצעד השבועי',
    reference: 'ויקיפדיה:בוט/בוט מצעדים/מדיה פורסט',
  },
  {
    path: 'bot/maintenance/removeDraftsFromCategories/index.ts',
    label: 'הסרת דפי טיוטה ומשתמש מקטגוריות של ערכים',
    reference: 'ויקיפדיה:בוט/הסרת דפי טיוטה מקטגוריות של מרחב הערכים',
  },
];

const codeSources = new Map(sources.map((source) => [`code:${source.path}`, source]));

export default codeSources;
