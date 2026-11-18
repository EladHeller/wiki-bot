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

export function operationSourcePath(path: string): boolean {
  if (['package.json', 'xmlbot/package.json', 'build/wiki-bot-playwright/Dockerfile'].includes(path)) return true;
  const harnessScript = /^scripts\/(?:bot-help-(?:experiment|preview|verify)|smoke-test)\.mjs$/;
  const harness = path.startsWith('bot/experiments/botHelp/') || harnessScript.test(path);
  const sourceFile = /^(?:bot|xmlbot|scripts|build|\.github\/workflows)\/[a-zA-Z0-9_./-]+\.(?:ts|[cm]?js|sh|ya?ml)$/;
  return !harness && sourceFile.test(path)
    && !/(?:^|\/)(?:\.\.?|__tests__|TestsDocker|node_modules)(?:\/|$)|\.(?:test|spec)\./.test(path);
}

export function repositorySource(id: string): { path: string; label: string; reference: string } | undefined {
  if (!id.startsWith('code:')) return undefined;
  const path = id.slice('code:'.length);
  if (!operationSourcePath(path)) return undefined;
  return codeSources.get(id) ?? {
    path,
    label: path.split('/').join(' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
    reference: `https://github.com/EladHeller/wiki-bot/blob/master/${encodeURI(path)}`,
  };
}

export default codeSources;
