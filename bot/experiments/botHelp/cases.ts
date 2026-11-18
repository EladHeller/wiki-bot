export type HelpTopic = 'user-talk' | 'closed-discussions' | 'general';

export type HelpCase = {
  id: string;
  topic: HelpTopic;
  contextPage?: string;
  question: string;
  expectedSources: string[];
  evidence: string[];
  copyExample?: string;
  rubric: string;
  needsLiveData: boolean;
};

export const helpCases: HelpCase[] = [
  {
    id: 'enable-archive',
    topic: 'user-talk',
    question: 'אין לי עדיין ארכיון. מה להוסיף לדף השיחה שלי כדי שהבוט יתחיל לארכב?',
    expectedSources: ['wiki:user-talk-help'],
    evidence: ['תיבת ארכיון אוטומטי'],
    copyExample: '{{תיבת ארכיון אוטומטי}}',
    rubric: 'Recommend {{תיבת ארכיון אוטומטי}}. Do not require creating an archive first. Explain the default waiting period.',
    needsLiveData: false,
  },
  {
    id: 'existing-archives',
    topic: 'user-talk',
    question: 'כבר יש לי תיבת ארכיון עם קישורים. איך מפעילים את הבוט בלי לאבד את הארכיונים הקיימים?',
    expectedSources: ['wiki:user-talk-help'],
    evidence: ['להחליף', 'תיבת ארכיון אוטומטי'],
    rubric: 'Replace the archive-box template while preserving its existing archive links. Do not replace the whole box with an empty one.',
    needsLiveData: false,
  },
  {
    id: 'missing-direct-archive',
    topic: 'user-talk',
    question: 'הגדרתי מיקום דף ארכיון אחרון לדף שלא קיים. האם הבוט ייצור אותו כשיהיה דיון לארכוב?',
    expectedSources: ['rule:user-talk', 'code:user-talk'],
    evidence: ['מיקום דף ארכיון אחרון', 'הבוט יוצר את דף היעד'],
    rubric: 'The direct archive is created when eligible content is archived. This does not establish that the bot has already run.',
    needsLiveData: false,
  },
  {
    id: 'disable-overflow',
    topic: 'user-talk',
    question: 'איך מונעים מהבוט לפתוח את הארכיון הבא כשדף הארכיון מתמלא?',
    expectedSources: ['wiki:archive-template', 'code:user-talk'],
    evidence: ['יצירת דף ארכיון חדש', 'לא'],
    copyExample: '|יצירת דף ארכיון חדש=לא',
    rubric: 'Use יצירת דף ארכיון חדש=לא. Explain that overflow stops and a notification is posted; do not claim all creation is disabled.',
    needsLiveData: false,
  },
  {
    id: 'newsletters',
    topic: 'user-talk',
    question: 'אני רוצה שידיעות הטכנולוגיה יישמרו בארכיון במקום להימחק. יש אפשרות כזאת?',
    expectedSources: ['wiki:archive-template', 'code:user-talk'],
    evidence: ['ארכוב הודעות תפוצה'],
    copyExample: '|ארכוב הודעות תפוצה=כן',
    rubric: 'Explain the default deletion of delivery-only messages and ארכוב הודעות תפוצה=כן.',
    needsLiveData: false,
  },
  {
    id: 'exclude-discussion',
    topic: 'user-talk',
    question: 'איך משאירים דיון מסוים בדף ולא נותנים לבוט לארכב אותו?',
    expectedSources: ['wiki:user-talk-help', 'wiki:archive-template', 'code:user-talk'],
    evidence: ['לא לארכוב'],
    copyExample: '{{לא לארכוב}}',
    rubric: 'Place {{לא לארכוב}} in that discussion; do not disable archiving for the entire page.',
    needsLiveData: false,
  },
  {
    id: 'signature-vs-edit',
    topic: 'closed-discussions',
    question: 'בארכוב דיונים לפי מצב, מספר הימים נספר מהעריכה האחרונה בדף או מהתגובה האחרונה בדיון?',
    expectedSources: ['wiki:closed-help', 'code:closed-discussions'],
    evidence: ['חתימ'],
    rubric: 'Use the last identified signature in the discussion. The configured delay varies and is not a universal 30 days.',
    needsLiveData: false,
  },
  {
    id: 'undated-discussion',
    topic: 'closed-discussions',
    question: 'מה קורה לדיון שמסומן כטופל אבל אין בו תאריך חתימה שהבוט מזהה?',
    expectedSources: ['wiki:closed-help', 'code:archive-utils'],
    evidence: ['ללא תאריך'],
    rubric: 'Describe the undated-paragraph tracker and waiting from first registration. Do not promise immediate archiving.',
    needsLiveData: false,
  },
  {
    id: 'explicit-destination',
    topic: 'closed-discussions',
    question: 'הדף מוגדר בתור תבנית ארכיון עם יעד והדיון טופל מזמן. האם חייבים למלא ארכוב בתבנית מצב?',
    expectedSources: ['wiki:closed-help', 'code:closed-discussions'],
    evidence: ['ארכוב=ארכיון'],
    copyExample: '|ארכוב=ארכיון',
    rubric: 'An explicit nonempty ארכוב parameter is required. Without it the discussion stays on the page. ארכוב=ארכיון chooses the normal archive.',
    needsLiveData: false,
  },
  {
    id: 'configure-not-develop',
    topic: 'user-talk',
    question: 'אני רוצה לארכב רק שיחות שיש בהן מילים מסוימות. צריך לפתח בשבילי בוט חדש?',
    expectedSources: ['wiki:archive-template', 'code:user-talk'],
    evidence: ['ביטויים לארכוב'],
    copyExample: '|ביטויים לארכוב=שלום*עולם',
    rubric: 'Explain the existing expression parameter and wildcard support. Avoid promising a new development or limiting matches to titles.',
    needsLiveData: false,
  },
  {
    id: 'unknown-current-failure',
    topic: 'general',
    question: 'הבוט לא ארכב אצלי היום. למה הוא הפסיק לעבוד?',
    expectedSources: [],
    evidence: [],
    rubric: 'Ask for the page and check current settings/activity/logs. Do not invent an outage, an AWS cause, or a successful run.',
    needsLiveData: true,
  },
  {
    id: 'configured-closed-discussions',
    topic: 'closed-discussions',
    contextPage: 'ויקיפדיה:קטגוריה/אולם דיונים',
    question: 'כאן באולם הדיונים של הקטגוריות, אחרי כמה זמן מתארכב דיון שמסומן כטופל? האם אפשר לדעת אם דיון מסוים כבר היה אמור להתארכב?',
    expectedSources: [],
    evidence: [],
    rubric: 'Read the live configuration for the page and status. Explain that a specific discussion needs its last signature and archive setting. Give no unverified diagnosis.',
    needsLiveData: true,
  },
  {
    id: 'unknown-new-task',
    topic: 'general',
    question: 'אפשר שהבוט יעדכן אוטומטית נתון מאתר חדש שאשלח לך, גם אם אין היום פעולה כזאת?',
    expectedSources: [],
    evidence: [],
    rubric: 'Separate technical feasibility and reusable components from an implemented or approved capability. Ask for source, target and update rules.',
    needsLiveData: true,
  },
];
