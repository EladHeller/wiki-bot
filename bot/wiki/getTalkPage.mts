const namespaces = [
  'שיחה',
  'משתמש',
  'שיחת משתמש',
  'ויקיפדיה',
  'שיחת ויקיפדיה',
  'קובץ',
  'שיחת קובץ',
  'מדיה ויקי',
  'שיחת מדיה ויקי',
  'תבנית',
  'שיחת תבנית',
  'עזרה',
  'שיחת עזרה',
  'קטגוריה',
  'שיחת קטגוריה',
  'פורטל',
  'שיחת פורטל',
  'ספר',
  'שיחת ספר',
  'טיוטה',
  'שיחת טיוטה',
  'TimedText',
  'TimedText talk',
  'יחידה',
  'שיחת יחידה',
  "גאדג'ט",
  "שיחת גאדג'ט",
  "הגדרת גאדג'ט",
  "שיחת הגדרת גאדג'ט",
  'נושא',
  'מדיה',
  'מיוחד',
];

export default function getTalkPageTitle(title: string): string | null {
  if (title === '') {
    return null;
  }
  const [nameSpaceOrArticle, ...rest] = title.split(':');
  if (rest.length >= 1 && (nameSpaceOrArticle === 'שיחה' || nameSpaceOrArticle.startsWith('שיחת '))) {
    return title;
  }
  if (rest.length === 0 || !namespaces.includes(nameSpaceOrArticle)) {
    return `שיחה:${title}`;
  }
  const namespace = nameSpaceOrArticle;
  const talkNameSpace = `שיחת ${namespace}`;
  if (namespaces.includes(talkNameSpace)) {
    return `${talkNameSpace}:${rest.join(':')}`;
  }
  return null;
}
