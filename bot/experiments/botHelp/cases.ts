export type HelpCase = {
  id: string;
  question: string;
  expectedSources: string[];
  evidence: string[];
  rubric: string;
  needsLiveData: boolean;
};

export const helpCases: HelpCase[] = [
  {
    id: 'enable-archive',
    question: 'אין לי עדיין ארכיון. מה להוסיף לדף השיחה שלי כדי שהבוט יתחיל לארכב?',
    expectedSources: ['wiki:user-talk-help'],
    evidence: ['תיבת ארכיון אוטומטי'],
    rubric: 'Recommend {{תיבת ארכיון אוטומטי}}. Do not require creating an archive first. Explain the default waiting period.',
    needsLiveData: false,
  },
  {
    id: 'existing-archives',
    question: 'כבר יש לי תיבת ארכיון עם קישורים. איך מפעילים את הבוט בלי לאבד את הארכיונים הקיימים?',
    expectedSources: ['wiki:user-talk-help'],
    evidence: ['להחליף', 'תיבת ארכיון אוטומטי'],
    rubric: 'Replace the archive-box template while preserving its existing archive links. Do not replace the whole box with an empty one.',
    needsLiveData: false,
  },
  {
    id: 'missing-direct-archive',
    question: 'הגדרתי מיקום דף ארכיון אחרון לדף שלא קיים. האם הבוט ייצור אותו כשיהיה דיון לארכוב?',
    expectedSources: ['code:user-talk'],
    evidence: ['archiveParagraphs', 'wikiApi.create'],
    rubric: 'The direct archive is created when eligible content is archived. This does not establish that the bot has already run.',
    needsLiveData: false,
  },
  {
    id: 'disable-overflow',
    question: 'איך מונעים מהבוט לפתוח את הארכיון הבא כשדף הארכיון מתמלא?',
    expectedSources: ['wiki:archive-template', 'code:user-talk'],
    evidence: ['יצירת דף ארכיון חדש', 'לא'],
    rubric: 'Use יצירת דף ארכיון חדש=לא. Explain that overflow stops and a notification is posted; do not claim all creation is disabled.',
    needsLiveData: false,
  },
  {
    id: 'newsletters',
    question: 'אני רוצה שידיעות הטכנולוגיה יישמרו בארכיון במקום להימחק. יש אפשרות כזאת?',
    expectedSources: ['wiki:archive-template', 'code:user-talk'],
    evidence: ['ארכוב הודעות תפוצה'],
    rubric: 'Explain the default deletion of delivery-only messages and ארכוב הודעות תפוצה=כן.',
    needsLiveData: false,
  },
  {
    id: 'exclude-discussion',
    question: 'איך משאירים דיון מסוים בדף ולא נותנים לבוט לארכב אותו?',
    expectedSources: ['wiki:user-talk-help', 'wiki:archive-template', 'code:user-talk'],
    evidence: ['לא לארכוב'],
    rubric: 'Place {{לא לארכוב}} in that discussion; do not disable archiving for the entire page.',
    needsLiveData: false,
  },
  {
    id: 'signature-vs-edit',
    question: 'בארכוב דיונים לפי מצב, מספר הימים נספר מהעריכה האחרונה בדף או מהתגובה האחרונה בדיון?',
    expectedSources: ['wiki:closed-help', 'code:closed-discussions'],
    evidence: ['חתימ'],
    rubric: 'Use the last identified signature in the discussion, not the page edit timestamp.',
    needsLiveData: false,
  },
  {
    id: 'undated-discussion',
    question: 'מה קורה לדיון שמסומן כטופל אבל אין בו תאריך חתימה שהבוט מזהה?',
    expectedSources: ['wiki:closed-help', 'code:archive-utils'],
    evidence: ['ללא תאריך'],
    rubric: 'Describe the undated-paragraph tracker and waiting from first registration. Do not promise immediate archiving.',
    needsLiveData: false,
  },
  {
    id: 'explicit-destination',
    question: 'הדף מוגדר בתור תבנית ארכיון עם יעד והדיון טופל מזמן. האם חייבים למלא ארכוב בתבנית מצב?',
    expectedSources: ['wiki:closed-help', 'code:closed-discussions'],
    evidence: ['ארכוב=ארכיון'],
    rubric: 'An explicit nonempty ארכוב parameter is required in this mode; ארכוב=ארכיון chooses the normal archive.',
    needsLiveData: false,
  },
  {
    id: 'configure-not-develop',
    question: 'אני רוצה לארכב רק שיחות שיש בהן מילים מסוימות. צריך לפתח בשבילי בוט חדש?',
    expectedSources: ['wiki:archive-template', 'code:user-talk'],
    evidence: ['ביטויים לארכוב'],
    rubric: 'Explain the existing expression parameter and wildcard support. Avoid promising a new development or limiting matches to titles.',
    needsLiveData: false,
  },
  {
    id: 'unknown-current-failure',
    question: 'הבוט לא ארכב אצלי היום. למה הוא הפסיק לעבוד?',
    expectedSources: [],
    evidence: [],
    rubric: 'Ask for the page and check current settings/activity/logs. Do not invent an outage, an AWS cause, or a successful run.',
    needsLiveData: true,
  },
  {
    id: 'unknown-new-task',
    question: 'אפשר שהבוט יעדכן אוטומטית נתון מאתר חדש שאשלח לך, גם אם אין היום פעולה כזאת?',
    expectedSources: [],
    evidence: [],
    rubric: 'Separate technical feasibility and reusable components from an implemented or approved capability. Ask for source, target and update rules.',
    needsLiveData: true,
  },
];
