import copyrightViolationPages, { copyrightEditThreshold, extraCopyrightResultsPage } from '../../maintenance/copyrightViolationPages';
import sportsReportPage from '../../sportPersonalityTemplatesYearsFormat/reportPage';

const copyrightTopic = /זכויות\s+ה?יוצרים|copyvios/iu;
const reportQuestion = /לוג|יומן|ד(?:ו[״"']?ח|יווח)|איפה.*(?:תוצאות|ממצאים)|היכן.*(?:תוצאות|ממצאים)/u;
const recentRunQuestion = /(?:ריצה|הרצה|הריצות|הרצות)\s+(?:ה)?אחרונ|(?:רץ|רצה)\s+(?:לאחרונה|היום|אתמול)/u;
const copyrightExplanation = /איך|כיצד|מה\s+(?:עושה|בודק|הבוט)|באילו\s+דפים/u;
const sportsTopic = /כדור(?:סלנ|גלנ)(?:ים|יות)?|אישיות\s+(?:כדורסל|כדורגל)|תבניות\s+אישיות\s+ספורט/u;
const sportsOperationQuestion = /בוט|פורמט|טווחי\s+שנים|שדות\s+תאריכים/u;

const copyrightReports = [
  `[[${copyrightViolationPages.new}|חשדות בדפים חדשים]]`,
  `[[${copyrightViolationPages.edit}|חשדות בעקבות עריכות]]`,
  `[[${extraCopyrightResultsPage(copyrightViolationPages.new)}|לוג הבדיקות של דפים חדשים]]`,
  `[[${extraCopyrightResultsPage(copyrightViolationPages.edit)}|לוג הבדיקות בעקבות עריכות]]`,
].join(' · ');

export default function answerKnownOperation(question: string): string | null {
  if (recentRunQuestion.test(question)) return null;
  if (copyrightTopic.test(question)) {
    if (reportQuestion.test(question)) {
      return `החשדות מתפרסמים בדפים הראשיים של הבדיקה. דפי המשנה „לוג” מרכזים תוצאות נוספות, ובהן דפים שנבדקו בלי שנמצאה התאמה.\n\n${copyrightReports}`;
    }
    if (copyrightExplanation.test(question)) {
      return `הבוט משתמש ב־Copyvios כדי לחפש התאמות בין טקסט בוויקיפדיה לטקסט באתרים אחרים. הוא בודק דפים חדשים וגם עריכות שהוסיפו לפחות ${copyrightEditThreshold.toLocaleString('en-US')} בתים. התאמה היא סימן לבדיקה אנושית.\n\n${copyrightReports}`;
    }
  }
  if (sportsTopic.test(question) && sportsOperationQuestion.test(question)) {
    return `הבוט מסדר את פורמט השנים בתבניות {{תב|אישיות כדורסל}} ו־{{תב|אישיות כדורגל}}. בתבנית הכדורסל הוא בודק את השדות של שנות הפעילות כשחקן, כמאמן, כג׳נרל מנג׳ר ובמכללה. למשל, הוא הופך טווח שנכתב בסדר הפוך לטווח מהשנה המוקדמת למאוחרת, מסיר קישורים משנים ומאחד את סוג המקף.\n\n[[${sportsReportPage}|דוח הבוט]]`;
  }
  return null;
}
