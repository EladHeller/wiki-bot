import fs from 'node:fs/promises';
import OpenAI from 'openai';
import { createHelpClassifier, previewTagHelp } from '../dist/tag-bot/help/preview.js';
import { helpCases } from '../dist/experiments/botHelp/cases.js';

const output = 'experiment-output/bot-help';
const model = process.env.BOT_HELP_MODEL || 'gpt-4o-mini';
const manifest = JSON.parse(await fs.readFile(`${output}/manifest.json`, 'utf8'));
const seedIntents = [
  'start', 'preserve', 'missing-destination', 'prevent-overflow', 'newsletters',
  'exclude-section', 'status-date', 'undated', 'require-target', 'filter-text',
  'unknown-failure', 'page-timing', 'new-task',
];
const configuredPage = 'ויקיפדיה:קטגוריה/אולם דיונים';
const cases = [
  ...helpCases.map((entry, index) => ({
    id: entry.id, intent: seedIntents[index], question: entry.question, page: entry.contextPage, copy: entry.copyExample,
  })),
  ...[
    ['start', 'אף פעם לא העברתי שיחות לארכיון. איך גורמים לזה לקרות לבד בעמוד השיחה שלי?'],
    ['preserve', 'יש בדף השיחה שלי תיבה עם כל הארכיונים הישנים. איך עוברים לארכוב אוטומטי בלי למחוק אותם?'],
    ['missing-destination', 'שמתי קישור אדום ב״מיקום דף ארכיון אחרון״. צריך לפתוח בעצמי את הדף?'],
    ['prevent-overflow', 'ברגע שהארכיון מגיע לתקרת הגודל, אני רוצה שהבוט יעצור בלי לייצר עוד אחד. איך?'],
    ['newsletters', 'ראיתי שידיעות הטכנולוגיה נעלמות מדף השיחה. איך לשמור אותן בארכיון כמו דיונים רגילים?'],
    ['exclude-section', 'בדף השיחה שלי יש שרשור אחד שצריך להישאר פתוח גם אם עברו חודשים. מה לשים רק בו?'],
    ['status-date', 'בארכוב לפי מצב, עריכה טכנית שעשיתי בדף מאפסת את הספירה או שמה שקובע הוא החתימה בדיון?'],
    ['undated', 'בארכוב לפי מצב, איך יודעים מתי להעביר דיון בלי חתימות וללא תאריך?'],
    ['require-target', 'בתצורה ״תבנית ארכיון עם יעד״ השארתי את שדה ארכוב ריק. לאן יעבור הדיון?'],
    ['filter-text', 'אני רוצה שהבוט בארכוב דף השיחה יטפל רק בפסקאות שמופיעה בהן המילה תחבורה. אפשר?'],
    ['unknown-failure', 'הסעיף עדיין פה למרות שציפיתי שייעלם. אפשר לבדוק מה קרה בארכוב?'],
    ['new-task', 'יש נתון שמשתנה באתר העירייה. אפשר להוסיף לבוט יכולת לסנכרן אותו לוויקיפדיה?'],
    ['page-timing', 'פה באולם הדיונים, כמה ימים מחכים אחרי שמסמנים דיון ״טופל״?', configuredPage],
    ['unsupported', 'תארכב את הפסקה הזו עכשיו בבקשה.'],
    ['unsupported', 'איך מונעים מארכוב לפי מצב לארכב פסקה מסוימת במדיניות של מחיקה?'],
    ['unsupported', 'איך מפעילים את בוט קישורי השפה בדף חדש?'],
  ].map(([intent, question, page], index) => ({ id: `paraphrase-${index + 1}`, intent, question, page })),
  ...[
    ['exclude-section', 'יש לי דיון נעוץ בראש דף השיחה; איך שומרים דווקא עליו כשהשאר מתארכבים?'],
    ['status-date', 'הבוט בארכוב לפי מצב מחשיב שינוי כותרת בדיון בתור פעילות שממנה צריך להתחיל לספור?'],
    ['page-timing', 'כאן, מה פרק הזמן שקבעו למצב ״לא יבוצע״?', configuredPage, 'לא יבוצע'],
    ['unsupported', 'איך מפעילים סנכרון קטגוריות אוטומטי?'],
    ['new-task', 'אפשר לפתח פעולה שתשאב נתון מאתר של המועצה ותעדכן אותו אחת לחודש בערך?'],
  ].map(([intent, question, page, status], index) => ({ id: `additional-${index + 1}`, intent, question, page, status })),

];

const client = new OpenAI({ maxRetries: 0, timeout: 45_000 });
const classify = createHelpClassifier(client, model);
const checkNote = (entry) => {
  const notification = {
    type: 'mention',
    wiki: 'hewiki',
    title: { full: entry.page || 'שיחת משתמש:דוגמה' },
    '*': {
      body: `@Sapper-bot עזרה: ${entry.question}`,
      links: { primary: { url: 'https://he.wikipedia.org/wiki/Example#preview-comment' } },
    },
  };
  const configuration = manifest.wikiContexts['configured-closed-discussions'].configuration;
  return previewTagHelp(notification, 'Sapper-bot', classify, async () => configuration);
};

const rows = [];
for (let offset = 0; offset < cases.length; offset += 5) {
  const batch = cases.slice(offset, offset + 5);
  const answers = await Promise.all(batch.map(checkNote));
  rows.push(...batch.map((entry, index) => ({ ...entry, actual: answers[index] })));
  await fs.writeFile(`${output}/preview.json`, JSON.stringify(rows, null, 2));
}

const development = rows.slice(0, helpCases.length);
const paraphrases = rows.slice(helpCases.length);
function passedCheck(row) {
  if (row.actual?.intent !== row.intent) return false;
  if (row.copy && !row.actual.answer.includes(`<code><nowiki>${row.copy}</nowiki></code>`)) return false;
  if (row.intent === 'page-timing') {
    const current = manifest.wikiContexts['configured-closed-discussions'].configuration
      .find((rule) => rule.page === row.page && rule.statuses.includes(row.status ?? 'טופל'));
    if (!current || !row.actual.answer.includes(`${current.daysAfterLastActivity} ימי המתנה`)) return false;
    if (current.archiveType === 'תבנית ארכיון עם יעד' && !row.actual.answer.includes('בלי ערך הדיון נשאר בדף')) return false;
  }
  return true;
}
const passed = (group) => group.filter(passedCheck).length;
const report = [
  '# Bot help tagging preview',
  '',
  `Model: ${model}`,
  `Original cases: ${passed(development)}/${development.length}.`,
  `Follow-up cases: ${passed(paraphrases)}/${paraphrases.length}.`,
  `Additional cases: ${passed(paraphrases.filter((row) => row.id.startsWith('additional-')))}/5.`,
  '',
  ...rows.flatMap((row) => [
    `## ${row.id}`,
    row.question,
    `Expected: ${row.intent}. Actual: ${row.actual?.intent}. Passed: ${passedCheck(row)}.`,
    '````text',
    row.actual?.answer ?? '',
    '````',
    '',
  ]),
].join('\n');
await fs.writeFile(`${output}/report.md`, report);
console.log(report.split('\n').slice(0, 5).join('\n'));
if (passed(rows) !== rows.length) process.exitCode = 1;
