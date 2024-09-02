import 'dotenv/config';
import NewWikiApi from '../wiki/NewWikiApi';

const pages = new Set([
  'תבנית:דגל/ארמניה הסובייטית',
  'תבנית:דגל/אקרי (ברזיל)',
  'תבנית:דגל/ארמייה קריובה',
  'תבנית:דגל/ארצות הברית של סטלאלנד',
  'תבנית:דגל/ארמרה',
  'תבנית:דגל/ארצות הברית (45 כוכבים)',
  'תבנית:דגל/בוואריה מעוינים',
  'תבנית:דגל/בורגוס',
  'תבנית:דגל/בוסניה והרצגובינה (1943–1992)',
  "תבנית:דגל/בקשצ'אבה",
  'תבנית:דגל/ברית המועצות (1980-1991)',
  'תבנית:דגל/ברנדנבורג',
  "תבנית:דגל/ג'יבוטי",
  "תבנית:דגל/ג'מייקה",
  'תבנית:דגל/ברמודה',
  'תבנית:דגל/ברית המועצות',
  'תבנית:דגל/ברן (קנטון)',
  'תבנית:דגל/בריזיליה',
  'תבנית:דגל/ברטיסלאבה (מחוז)',
  "תבנית:דגל/ג'יש-י מוחמד",
  'תבנית:דגל/גיפוסקואה',
  'תבנית:דגל/גואטמלה (מחוז)',
  'תבנית:דגל/גדלה',
  'תבנית:דגל/גרמניה הנאצית (1933–1935)',
  'תבנית:דגל/גרמניה המזרחית (1949–1959)',
  'תבנית:דגל/גרנד קרו',
  'תבנית:דגל/דובסרי (מחוז)',
  'תבנית:דגל/דברצן',
  'תבנית:דגל/דרום קוריאה',
  'תבנית:דגל/דרום תימן',
  'תבנית:דגל/האומות המאוחדות',
  'תבנית:דגל/דרום אירלנד',
  'תבנית:דגל/דורנוד',
  'תבנית:דגל/דלסלנד',
  'תבנית:דגל/דנמרק (1300)',
  'תבנית:דגל/דוכסות סקסוניה-קובורג-גותה',
  'תבנית:דגל/האימפריה הרוסית',
  'תבנית:דגל/האיחוד האפקריאי',
  'תבנית:דגל/האימפריה האוסטרו-הונגרית',
  'תבנית:דגל/האימפריה היפנית',
  'תבנית:דגל/האיחוד הערבי',
  'תבנית:דגל/האיחוד השוודי-נורווגי',
  'תבנית:דגל/האימפריה המקסיקנית הראשונה',
  'תבנית:דגל/האימפריה הבריטית',
  'תבנית:דגל/האימפריה האתיופית',
  'תבנית:דגל/האימפריה הקולוניאלית השוודית',
  'תבנית:דגל/הודו',
  'תבנית:דגל/הבריגדות הבין-לאומיות',
  'תבנית:דגל/הוועד הבין-לאומי של הצלב האדום והסהר האדום',
  'תבנית:דגל/ההגנה',
  'תבנית:דגל/האימפריה הרוסית (1858–1883)',
  'תבנית:דגל/האימפריה הרוסית (1883–1917)',
  'תבנית:דגל/האלפים הימיים',
  'תבנית:דגל/הדוכסות הגדולה של ליטא',
  'תבנית:דגל/הדוכסות הגדולה של הסן',
  'תבנית:דגל/הדוכסות הגדולה של מקלנבורג-שטרליץ',
  'תבנית:דגל/הבריגדות הבינלאומיות',
  'תבנית:דגל/הוועד הבינלאומי של הצלב האדום והסהר האדום',
  'תבנית:דגל/הווש',
  'תבנית:דגל/הונגריה (1940–1945)',
  'תבנית:דגל/הונגריה כולל סמל (לא רשמי, 1957–1989)',
  'תבנית:דגל/החזית הדמוקרטית לשחרור פלסטין',
  'תבנית:דגל/הונגריה (1957–1989)',
  'תבנית:דגל/הטריטוריות הצפון-מערביות',
  'תבנית:דגל/היידו-ביהר',
  'תבנית:דגל/החזית הלבנונית',
  'תבנית:דגל/המטה הכללי של צה"ל',
  'תבנית:דגל/המשרד הקולוניאלי הגרמני',
  'תבנית:דגל/המפלגה הקומוניסטית הסינית',
  'תבנית:דגל/הממלכה המאוחדת של ארצות השפלה',
  'תבנית:דגל/הניינץ',
  'תבנית:דגל/המשמר הלאומי של אוקראינה',
  'תבנית:דגל/הממלכה הערבית של סוריה',
  'תבנית:דגל/הפלנגות הנוצריות',
  'תבנית:דגל/הצי הגרמני הקיסרי',
  'תבנית:דגל/הצבא המלכותי האיטלקי',
  'תבנית:דגל/הצי הקיסרי הגרמני',
  'תבנית:דגל/הצבא המצרי',
  'תבנית:דגל/הצי הדרום אפריקאי',
  'תבנית:דגל/הפדרציה של בוסניה והרצגובינה',
  'תבנית:דגל/הפרובינציות המאוחדות של ריו דה לה פלטה',
  'תבנית:דגל/הפדרציה של מאלי',
  'תבנית:דגל/הפירנאים האטלנטיים',
  'תבנית:דגל/הצבא הלאומי הלובי',
  'תבנית:דגל/הפלפאף',
  'תבנית:דגל/העיר החופשית פרנקפורט',
  'תבנית:דגל/הצי ההולנדי המלכותי',
  'תבנית:דגל/הצלב האדום',
  'תבנית:דגל/הרפובליקה הדמוקרטית של גאורגיה',
  'תבנית:דגל/הרפובליקה האיטלקית',
  'תבנית:דגל/הקונפדרציה הגרמנית (1848)',
  'תבנית:דגל/הקהילה האוטונומית של מורסיה',
  'תבנית:דגל/הקונפדרציה השווייצרית הישנה',
  'תבנית:דגל/הקונפדרציה הגרמנית',
  'תבנית:דגל/הקונפדרציה',
  'תבנית:דגל/הקונפדרציה הפרו בוליביאנית',
  'תבנית:דגל/הקהילה של אמריקה הלטינית והמדינות הקריביות',
  'תבנית:דגל/הצי התימני',
  'תבנית:דגל/הרפובליקה המרכז-אפריקאית',
  'תבנית:דגל/הרפובליקה הסינית',
  'תבנית:דגל/הרפובליקה הסוציאליסטית של בוסניה והרצגובינה',
  'תבנית:דגל/הרפובליקה הסובייטית הסוציאליסטית האוזבקית',
  'תבנית:דגל/הרפובליקה הסורית השנייה',
  'תבנית:דגל/הרפובליקה הסינית (1912–1928)',
  'תבנית:דגל/הרפובליקה הסובייטית העממית הבוכרית',
  'תבנית:דגל/הרפובליקה העממית הסובייטית הבוכרית',
  'תבנית:דגל/הרפובליקה המרכז אפריקאית',
  'תבנית:דגל/וויילס',
  'תבנית:דגל/ווילס',
  'תבנית:דגל/וושינגטון (מדינה)',
  'תבנית:דגל/וולטה עילית',
  "תבנית:דגל/ואל ד'אוסטה",
  'תבנית:דגל/הרפובליקה הצרפתית הראשונה (1794–1804)',
  'תבנית:דגל/וייטנאם',
  'תבנית:דגל/ויילס',
  'תבנית:דגל/וסטפליה',
  'תבנית:דגל/וסקה',
  'תבנית:דגל/ולוניה',
  'תבנית:דגל/ועדות ההתנגדות העממית',
  'תבנית:דגל/וראקרוס (מדינה)',
  'תבנית:דגל/ורמאכט',
  'תבנית:דגל/ורמיה-מזוריה',
  'תבנית:דגל/ולפראיסו (מחוז)',
  'תבנית:דגל/ורמלנד',
  'תבנית:דגל/ונדה',
  'תבנית:דגל/וירטמברג-הוהנצולרן',
  'תבנית:דגל/ונציה',
  'תבנית:דגל/ולדיווסטוק',
  'תבנית:דגל/זאיר 1960',
  'תבנית:דגל/חוחוי (פרובינציה)',
  'תבנית:דגל/חברת דרום אפריקה הבריטית',
  'תבנית:דגל/זרם העתיד',
  'תבנית:דגל/זאגרב',
  'תבנית:דגל/זנזיבר (1964)',
  'תבנית:דגל/חיל האוויר הסובייטי',
  'תבנית:דגל/חיל הטילים האסטרטגיים הסובייטי',
  'תבנית:דגל/חיל המודיעין',
  'תבנית:דגל/חיל הים ההודי',
  'תבנית:דגל/טאיפיי הסינית',
  'תבנית:דגל/חוראס אל-דין',
  'תבנית:דגל/טובאלו',
  'תבנית:דגל/טונגה',
  'תבנית:דגל/טיבט',
  'תבנית:דגל/טביליסי',
  'תבנית:דגל/טייוואן',
  'תבנית:דגל/טוקלאו',
  'תבנית:דגל/טוקנטינס (מדינה)',
  'תבנית:דגל/טוטורי (מחוז)',
  "תבנית:דגל/טוצ'יגי (מחוז)",
  'תבנית:דגל/טורונטו',
  'תבנית:דגל/טוגולנד הצרפתית',
  'תבנית:דגל/טאקאמאטסו האן',
  'תבנית:דגל/טלנשטי (מחוז)',
  'תבנית:דגל/יאפ',
  'תבנית:דגל/טרגונה',
  'תבנית:דגל/טריטוריית הבירה האוסטרלית',
  'תבנית:דגל/טריטוריית פפואה וגינאה החדשה',
  "תבנית:דגל/טרנטינו - אלטו אדיג'ה",
  'תבנית:דגל/יבלבורג',
  'תבנית:דגל/יושב ראש המטות המשולבים',
  'תבנית:דגל/לא ידוע',
  'תבנית:דגל/כורדיסטן',
  'תבנית:דגל/לבנון (1918–1943)',
  'תבנית:דגל/כוחות ההגנה האווירית העצמית של יפן',
  'תבנית:דגל/ימטלנד',
  "תבנית:דגל/ימאגוצ'י (מחוז)",
  'תבנית:דגל/כפר סבא',
  'תבנית:דגל/לאוטם',
  'תבנית:דגל/כך',
  'תבנית:דגל/יקטרינבורג',
  'תבנית:דגל/לבנון (1918-1943)',
  'תבנית:דגל/לוב (1951–1969)',
  'תבנית:דגל/לוב (1977–2011)',
  'תבנית:דגל/לה ריוחה (פרובינציה)',
  'תבנית:דגל/לוהנסק (מחוז)',
  'תבנית:דגל/ליברלנד',
  'תבנית:דגל/לוב (1977-2011)',
  'תבנית:דגל/לוב (1951-1969)',
  'תבנית:דגל/מאלי',
  'תבנית:דגל/מדגסקר',
  "תבנית:דגל/מדינת אורנג' החופשית",
  'תבנית:דגל/מדיירה',
  'תבנית:דגל/מדינת אירלנד החופשית',
  'תבנית:דגל/מגדן (מחוז)',
  'תבנית:דגל/מדינת האפיפיור',
  'תבנית:דגל/מאולה',
  'תבנית:דגל/מדינת הסלובנים, הקרואטים והסרבים',
  'תבנית:דגל/מדינת האיחוד',
  'תבנית:דגל/ליקה-סני',
  'תבנית:דגל/מדינה פלסטינית',
  'תבנית:דגל/מונקו',
  'תבנית:דגל/מונטסראט',
  'תבנית:דגל/מדריד',
  'תבנית:דגל/מורדוביה',
  'תבנית:דגל/מוהילב (מחוז)',
  'תבנית:דגל/מושבת הכף',
  'תבנית:דגל/מושבת ניגריה',
  'תבנית:דגל/מונאקו',
  'תבנית:דגל/מדינת חלב',
  'תבנית:דגל/מחוז אמור',
  'תבנית:דגל/מחוז אסטרחן',
  'תבנית:דגל/מחוז בלגורוד',
  'תבנית:דגל/מחוז אומסק',
  'תבנית:דגל/מחוז טומסק',
  'תבנית:דגל/מחוז טבר',
  'תבנית:דגל/מחוז חרסון',
  'תבנית:דגל/מחוז וילנה',
  'תבנית:דגל/מחוז לוהנסק',
  "תבנית:דגל/מחוז קמצ'טקה",
  'תבנית:דגל/מחוז קמרובו',
  "תבנית:דגל/מחוז צ'ליאבינסק",
  'תבנית:דגל/מחוז פנזה',
  'תבנית:דגל/מחוז פרימוריה',
  'תבנית:דגל/מחוז סחלין',
  'תבנית:דגל/מחוז קוסטרומה',
  'תבנית:דגל/מחוז לנינגרד',
  'תבנית:דגל/מחוז קייב',
  "תבנית:דגל/מחוז צ'רניהיב",
  'תבנית:דגל/מחוז מיקולאייב',
  'תבנית:דגל/מחוז סומי',
  'תבנית:דגל/מחוז קרסנודאר',
  'תבנית:דגל/מחוז מגדן',
  'תבנית:דגל/מחוז סברדלובסק',
  'תבנית:דגל/מחוז קאוקה',
  'תבנית:דגל/מיזורי',
  'תבנית:דגל/מינסוטה',
  'תבנית:דגל/מיוט',
  'תבנית:דגל/ממלכת בוואריה',
  'תבנית:דגל/ממלכת וירטמברג',
  'תבנית:דגל/מינסק (מחוז)',
  'תבנית:דגל/ממלכת הצרפתים',
  'תבנית:דגל/ממלכת הסיקים',
  'תבנית:דגל/ממלכת סרביה',
  'תבנית:דגל/ממלכת סיציליה',
  "תבנית:דגל/ממלכת נורת'מבריה",
  'תבנית:דגל/ממלכת סאסקס',
  'תבנית:דגל/ממלכת פרוסיה (1803-1892)',
  'תבנית:דגל/ממלכת פרוסיה',
  'תבנית:דגל/ממלכת רומניה',
  'תבנית:דגל/ממלכת כארתלי-קאחתי',
  'תבנית:דגל/ממשלת האופוזיציה הסורית',
  'תבנית:דגל/ממלכת ספרד (1700-1810)',
  'תבנית:דגל/ממלכת לומברדיה-ונציה',
  'תבנית:דגל/ממלכת שתי הסיציליות',
  'תבנית:דגל/מצרים',
  'תבנית:דגל/מקסיקו',
  "תבנית:דגל/מערב וירג'יניה",
  'תבנית:דגל/מקדוניה 1991',
  'תבנית:דגל/מצרים (1805–1922)',
  'תבנית:דגל/מצרים (1952–1958)',
  'תבנית:דגל/מצרים (1958–1972)',
  'תבנית:דגל/מנסטר',
  'תבנית:דגל/מערב הרצגובינה (קנטון)',
  "תבנית:דגל/מערב בחר אל-ע'זאל",
  'תבנית:דגל/מקסיקו (1823–1864, 1867–1893)',
  'תבנית:דגל/מצרים (1805-1922)',
  'תבנית:דגל/מצרים (1958-1972)',
  'תבנית:דגל/מקסיקו (1823-1864, 1867-1893)',
  'תבנית:דגל/מצרים (1952-1958)',
  'תבנית:דגל/מרוקו',
  'תבנית:דגל/נבדה',
  'תבנית:דגל/נברה',
  'תבנית:דגל/מרידה',
  'תבנית:דגל/נארה (מחוז)',
  'תבנית:דגל/מרכז בוסניה (קנטון)',
  'תבנית:דגל/מרכז בוסניה',
  'תבנית:דגל/מקסיקו 1823',
  'תבנית:דגל/ניו זילנד',
  'תבנית:דגל/ניו מקסיקו',
  'תבנית:דגל/נובה סקוטיה',
  'תבנית:דגל/נונאווט',
  'תבנית:דגל/ניאסלנד',
  'תבנית:דגל/נגרי סמבילן',
  'תבנית:דגל/ניטרה (מחוז)',
  'תבנית:דגל/ניקרגואה (1908-1971)',
  'תבנית:דגל/נוגראד',
  'תבנית:דגל/סודאן',
  'תבנית:דגל/סודאן 1956',
  'תבנית:דגל/סבורגה',
  'תבנית:דגל/נסיכות מונטנגרו',
  'תבנית:דגל/סאחה',
  'תבנית:דגל/סארמאה',
  'תבנית:דגל/סאו פאולו',
  'תבנית:דגל/נסיכות שאומבורג-ליפה',
  'תבנית:דגל/נסיכות הבוחר מהנובר',
  'תבנית:דגל/סודאן (1956)',
  'תבנית:דגל/נסיכות הבוחר מפפאלץ',
  'תבנית:דגל/סיישל',
  'תבנית:דגל/סודן',
  'תבנית:דגל/סומליה',
  'תבנית:דגל/סינט מארטן',
  'תבנית:דגל/סונורה',
  'תבנית:דגל/סיציליה',
  'תבנית:דגל/סומלילנד הבריטית',
  'תבנית:דגל/סולולה',
  'תבנית:דגל/סומרסט',
  'תבנית:דגל/סוריה (1932-1958)',
  'תבנית:דגל/סוריה (1932–1958)',
  'תבנית:דגל/סמואה האמריקנית',
  'תבנית:דגל/סנגל',
  'תבנית:דגל/סמורה',
  'תבנית:דגל/סנט מארטן',
  'תבנית:דגל/סן מרטן',
  'תבנית:דגל/סנקט פטרבורג',
  'תבנית:דגל/סנטה פה (פרובינציה)',
  'תבנית:דגל/סנטה קרוס (פרובינציה)',
  'תבנית:דגל/ספליט-דלמטיה',
  'תבנית:דגל/ספורטאים אינדיבידואלים ניטרליים',
  'תבנית:דגל/סרביה ומונטנגרו',
  'תבנית:דגל/סקסוניה-אנהלט',
  'תבנית:דגל/ספרד 1939',
  'תבנית:דגל/ספרד (1945–1977)',
  'תבנית:דגל/עוצבת געש',
  'תבנית:דגל/עוצבת עידן',
  'תבנית:דגל/סקונהלנד',
  'תבנית:דגל/סקאפה (מחוז)',
  'תבנית:דגל/סרביה (1941–1944)',
  'תבנית:דגל/ספרד (1945-1977)',
  'תבנית:דגל/ספרד (1938–1936)',
  'תבנית:דגל/עומאן (1970)',
  'תבנית:דגל/עיראק',
  'תבנית:דגל/פוארטו ריקו',
  'תבנית:דגל/פהנג',
  'תבנית:דגל/פומרניה (פרובינציה)',
  'תבנית:דגל/פומרניה',
  "תבנית:דגל/פוג'יירה",
  'תבנית:דגל/פדרציית מאלי',
  'תבנית:דגל/פולין 1919–1928',
  'תבנית:דגל/פולין 1919-1928',
  'תבנית:דגל/פורטוגל',
  "תבנית:דגל/פיג'י",
  'תבנית:דגל/פינלנד',
  'תבנית:דגל/פלאו',
  'תבנית:דגל/פיטקרן',
  'תבנית:דגל/פומרניה המערבית',
  "תבנית:דגל/פיצ'ינצ'ה",
  "תבנית:דגל/פנג'אב (פקיסטן)",
  'תבנית:דגל/פלשטי (מחוז)',
  'תבנית:דגל/פלי"ם',
  'תבנית:דגל/פלנחה',
  'תבנית:דגל/פורטוגל (1521)',
  'תבנית:דגל/פיד"ה',
  'תבנית:דגל/פורטוגל (1750)',
  'תבנית:דגל/פורטוגל (1816)',
  'תבנית:דגל/פלסטינים',
  'תבנית:דגל/פרו',
  'תבנית:דגל/פראג',
  'תבנית:דגל/פרויה',
  "תבנית:דגל/צ'אקו (פרובינציה)",
  "תבנית:דגל/צ'ובשיה",
  'תבנית:דגל/פרנה (מדינה)',
  'תבנית:דגל/פראנש-קונטה',
  'תבנית:דגל/פרק',
  'תבנית:דגל/פננג',
  'תבנית:דגל/פרק (מלזיה)',
  'תבנית:דגל/פס-בולמאן',
  'תבנית:דגל/פסטסה',
  'תבנית:דגל/פתח אל-אסלאם',
  'תבנית:דגל/פרס (1910–1925)',
  'תבנית:דגל/פפואה האוסטרלית',
  'תבנית:דגל/פרס (1910-1925)',
  'תבנית:דגל/פרו (1884–1950)',
  'תבנית:דגל/פשט (מחוז)',
  'תבנית:דגל/פשט',
  "תבנית:דגל/צ'צ'ניה",
  "תבנית:דגל/צ'יוואווה",
  'תבנית:דגל/צפון הולנד',
  "תבנית:דגל/צ'שייר",
  "תבנית:דגל/צ'וקוטקה",
  'תבנית:דגל/צפון אוסטיה - אלניה',
  'תבנית:דגל/צבא ממלכת איטליה',
  'תבנית:דגל/צפון אפירוס',
  'תבנית:דגל/ציריך',
  'תבנית:דגל/צו האן',
  'תבנית:דגל/צלב החץ',
  "תבנית:דגל/צבא הג'יהאד הקדוש",
  'תבנית:דגל/ציילון',
  "תבנית:דגל/צ'ימישליה (מחוז)",
  'תבנית:דגל/ציילון הבריטית',
  'תבנית:דגל/צבא סוריה',
  'תבנית:דגל/צבא הדגל השחור',
  'תבנית:דגל/צבא מצרים',
  'תבנית:דגל/צפון קוריאה',
  //   "תבנית:דגל/קאראצ'אי-צ'רקסיה",
  'תבנית:דגל/קואלה לומפור',
  'תבנית:דגל/קואנקה (נפה באקוודור)',
  'תבנית:דגל/קאחול (מחוז)',
  'תבנית:דגל/קאושני (מחוז)',
  'תבנית:דגל/קאנגוואנה',
  'תבנית:דגל/קולומביה',
  'תבנית:דגל/קוסטה ריקה',
  'תבנית:דגל/קוריאה הדרומית',
  'תבנית:דגל/קומורו',
  'תבנית:דגל/קולורדו',
  'תבנית:דגל/קונטיקט',
  'תבנית:דגל/קולומביה הבריטית',
  'תבנית:דגל/קטלוניה',
  'תבנית:דגל/קורדובה',
  'תבנית:דגל/קונפדרציית המדינות של אמריקה',
  'תבנית:דגל/קורדובה (פרובינציה)',
  'תבנית:דגל/קולימה (מדינה)',
  'תבנית:דגל/קוממוטו (מחוז)',
  "תבנית:דגל/קוצ'י (מחוז)",
  'תבנית:דגל/קיוטו (מחוז)',
  'תבנית:דגל/קושיצה (מחוז)',
  'תבנית:דגל/קולומביה הגדולה',
  'תבנית:דגל/קניה',
  'תבנית:דגל/קפריסין',
  'תבנית:דגל/קנדה (1921–1957)',
  'תבנית:דגל/קנדה (1957–1965)',
  'תבנית:דגל/קנטבריה',
  'תבנית:דגל/קירגיסטן',
  'תבנית:דגל/קירגיזסטן 1991–1992',
  'תבנית:דגל/קירנאיקה האיטלקית',
  'תבנית:דגל/קירגיזסטן 1991-1992',
  'תבנית:דגל/קנדה (1921-1957)',
  'תבנית:דגל/קנדה (1957-1965)',
  'תבנית:דגל/רומניה',
  'תבנית:דגל/רואנדה (1962–2001)',
  'תבנית:דגל/קרנטקה',
  'תבנית:דגל/קרליה',
  'תבנית:דגל/קרסנודאר (מחוז)',
  'תבנית:דגל/קרטרו (מדינה)',
  'תבנית:דגל/קרליה (רפובליקה)',
  'תבנית:דגל/רומא',
  'תבנית:דגל/קריולני (מחוז)',
  'תבנית:דגל/רומניה (1952–1965)',
  'תבנית:דגל/קרפינה-זגוריה',
  'תבנית:דגל/רואנדה (1962-2001)',
  'תבנית:דגל/רומניה (1952-1965)',
  'תבנית:דגל/רפובליקת סאחה-יקוטיה',
  'תבנית:דגל/רפובליקת טובה',
  'תבנית:דגל/רפובליקת קמר',
  'תבנית:דגל/רפובליקת מזרח טורקיסטן הראשונה',
  "תבנית:דגל/רפובליקת פוצ'פסטרום-ויינבורג",
  "תבנית:דגל/ריו דה ז'ניירו",
  'תבנית:דגל/שוודיה',
  'תבנית:דגל/שווייץ',
  'תבנית:דגל/שוויץ',
  'תבנית:דגל/תימן',
  'תבנית:דגל/שלזוויג-הולשטיין',
  'תבנית:דגל/תל אביב-יפו',
  'תבנית:דגל/שירות הביטחון האוקראיני',
  'תבנית:דגל/שבדיה',
  'תבנית:דגל/שיגה (מחוז)',
  'תבנית:דגל/שיזואוקה (מחוז)',
  'תבנית:דגל/שיבניק-קנין',
  'תבנית:דגל/שטח חסות רוס',
  "תבנית:דגל/שומוג'",
]);
export async function main() {
  const api = NewWikiApi();
  try {
    await api.login();
    for (const title of pages) {
      await api.protect(title, '', 'never', 'באג של ויקיפדיה');
      await api.protect(title, 'edit=editautopatrolprotected|move=editautopatrolprotected', 'never', 'תבנית דגל: בשימוש רב');
    }
    console.log('Done');
  } catch (e) {
    console.error(e);
  }
}

export default main;