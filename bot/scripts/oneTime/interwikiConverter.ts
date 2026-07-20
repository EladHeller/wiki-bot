import { runSinglePage } from '../../interwikiLinks';
import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage, convertContentToWikiPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';

const NON_WIKIPEDIA_PROJECT_PREFIXES = 'b|c|commons|d|dictionary|m|meta|mw|n|q|quote|s|source|species|v|voyage|wikibooks|wikidata|wikifunctions|wikimedia|wikinews|wikiquote|wikisource|wikiversity|wikivoyage|wiktionary';
const BASE_SEARCH_PATTERN = '\\"?\\[\\[([^]]+)\\]\\]\\"?\\s*\'*\\<small\\>\\s*\\(\'*?\\[\\[:([a-zA-Z-]+):';
const SEARCH_PATTERN = `${BASE_SEARCH_PATTERN}(?!(?:${NON_WIKIPEDIA_PROJECT_PREFIXES}):)([^]|]+)\\|[א-ת-' ]+['׳]?\\)?\\]\\]'*\\)?\\s*(\\((?:</small><small>)?\\d+(?:-\\d+)?(?:</small><small>)?\\d*(?:\\s*[,-–]\\s*\\d+)*\\))?\\s*([.,;:)]|(?:{{ש}}))*\\s*\\<\\/small\\>'*`;
const regex = new RegExp(SEARCH_PATTERN.replaceAll('^]', '^\\]'), 'gi');
const SUMMARY = 'הסבת קישורי בינוויקי לתבנית קישור שפה';

const langugageCodeToLanguageName: Record<string, string> = {
  ab: 'אבחזית',
  ady: 'אדיגית',
  udm: 'אודמורטית',
  uz: 'אוזבקית',
  ug: 'אויגור',
  os: 'אוסטית',
  oc: 'אוקסיטנית',
  uk: 'אוקראינית',
  ur: 'אורדו',
  om: 'אורומו',
  or: 'אורייה',
  az: 'אזרית',
  it: 'איטלקית',
  inh: 'אינגושית',
  id: 'אינדונזית',
  iu: 'אינוקטיטוט',
  is: 'איסלנדית',
  ga: 'אירית',
  sq: 'אלבנית',
  als: 'אלמאנית',
  gsw: 'אלמאנית',
  am: 'אמהרית',
  en: 'אנגלית',
  simple: 'אנגלית פשוטה',
  ang: 'אנגלית עתיקה',
  'en-ca': 'אנגלית קנדית',
  as: 'אסאמית',
  et: 'אסטונית',
  ast: 'אסטורית',
  eo: 'אספרנטו',
  af: 'אפריקאנס',
  ace: 'אצ\'אית',
  an: 'אראגונית',
  'roa-rup': 'ארומנית',
  arc: 'ארמית',
  hy: 'ארמנית',
  bho: 'בהוג\'פורית',
  bh: 'בהוג\'פורית',
  bg: 'בולגרית',
  bs: 'בוסנית',
  bxr: 'בוריאטית',
  my: 'בורמזית',
  bi: 'ביסלמה',
  bpy: 'בישנופרייה מניפורי',
  be: 'בלארוסית',
  bn: 'בנגלית',
  eu: 'בסקית',
  br: 'ברטונית',
  ba: 'בשקירית',
  jv: 'ג\'אווה',
  ka: 'גאורגית',
  zh: 'סינית',
  'zh-yue': 'קנטונזית',
  gd: 'גאלית סקוטית',
  gag: 'גגאוזית',
  gaa: 'גה',
  gn: 'גוארני',
  gu: 'גוג\'ראטית',
  got: 'גותית',
  gl: 'גליסית',
  kl: 'גרינלנדית',
  de: 'גרמנית',
  nds: 'גרמנית תחתית',
  dz: 'דזונגקה',
  dv: 'דיבהי',
  da: 'דנית',
  ha: 'האוסה',
  ho: 'הארי מוטו',
  haw: 'הוואית',
  nl: 'הולנדית',
  hu: 'הונגרית',
  hif: 'הינדוסטני',
  hi: 'הינדית',
  war: 'ואריי-ואריי',
  vot: 'וודית',
  vi: 'וייטנאמית',
  wa: 'ולונית',
  cy: 'ולשית',
  ve: 'ונדה',
  vec: 'ונטית',
  diq: 'זאזאקי',
  zu: 'זולו',
  zea: 'זילנדית',
  tl: 'טאגאלוג',
  tg: 'טג\'יקית',
  tyv: 'טובאנית',
  to: 'טונגאית',
  tpi: 'טוק פיסין',
  tr: 'טורקית',
  ota: 'טורקית עות\'מאנית',
  tk: 'טורקמנית',
  tet: 'טטום',
  tt: 'טטרית',
  crh: 'טטרית של קרים',
  bo: 'טיבטית',
  te: 'טלוגו',
  ta: 'טמילית',
  tn: 'טסואנה',
  el: 'יוונית',
  yo: 'יורובה',
  yi: 'יידיש',
  ja: 'יפנית',
  ku: 'כורדית',
  lad: 'לאדינו',
  lo: 'לאו',
  lg: 'לוגנדה',
  lb: 'לוקסמבורגית',
  lv: 'לטבית',
  ltg: 'לטגלית',
  la: 'לטינית',
  liv: 'ליבונית',
  lij: 'ליגורית',
  lt: 'ליטאית',
  li: 'לימבורגית',
  mi: 'מאורית',
  mai: 'מאיתילית',
  gv: 'מאנית',
  xmf: 'מגרלית',
  mo: 'מולדובנית',
  mn: 'מונגולית',
  min: 'מיננגקבאו',
  mwl: 'מירנדזית',
  ml: 'מלאיאלאם',
  ms: 'מלאית',
  mg: 'מלגשית',
  mt: 'מלטית',
  mk: 'מקדונית',
  mr: 'מראטהית',
  mh: 'מרשלית',
  nv: 'נאוואחו',
  nah: 'נאוואטל',
  na: 'נאורית',
  no: 'נורווגית',
  nn: 'נורווגית חדשה',
  nb: 'נורווגית ספרותית',
  new: 'נפאל בהאסה',
  ne: 'נפאלית',
  nap: 'נפוליטנית',
  se: 'סמי צפונית',
  ceb: 'סבואנו',
  sw: 'סווהילי',
  ss: 'סווזי',
  so: 'סומלית',
  sd: 'סינדהי',
  si: 'סינהלית',
  scn: 'סיציליאנית',
  sl: 'סלובנית',
  sk: 'סלובקית',
  sm: 'סמואית',
  sa: 'סנסקריט',
  st: 'ססוטו',
  es: 'ספרדית',
  sco: 'סקוטית',
  sh: 'סרבו-קרואטית',
  sr: 'סרבית',
  sc: 'סרדו',
  he: 'עברית',
  aa: 'עפרית',
  ar: 'ערבית',
  arz: 'ערבית מצרית',
  ary: 'ערבית מרוקאית',
  pi: 'פאלי',
  pap: 'פאפיאמנטו',
  fo: 'פארואזית',
  pl: 'פולנית',
  pt: 'פורטוגזית',
  'pt-br': 'פורטוגזית ברזילאית',
  fur: 'פורלן',
  fj: 'פיג\'ית',
  pms: 'פיימונטית',
  fi: 'פינית',
  pcd: 'פיקארד',
  pa: 'פנג\'אבי',
  fy: 'פריזית מערבית',
  frp: 'פרנקו-פרובנסאלית',
  fa: 'פרסית',
  peo: 'פרסית עתיקה',
  ps: 'פשטו',
  cv: 'צ\'ובשית',
  cs: 'צ\'כית',
  ch: 'צ\'מורו',
  ce: 'צ\'צ\'נית',
  chr: 'צ\'רוקי',
  ts: 'צונגה',
  fr: 'צרפתית',
  kn: 'קאנדה',
  kbd: 'קברדינית',
  xh: 'קוסה',
  ko: 'קוריאנית',
  kw: 'קורנית',
  co: 'קורסיקאית',
  kk: 'קזחית',
  ca: 'קטלאנית',
  ky: 'קירגיזית',
  rn: 'קירונדי',
  km: 'קמרית',
  hr: 'קרואטית',
  cr: 'קרי',
  ht: 'קריאולית האיטית',
  csb: 'קשובית',
  rmy: 'רומאני',
  rm: 'רומאנש',
  ro: 'רומנית',
  rue: 'רוסינית',
  ru: 'רוסית',
  sv: 'שוודית',
  sn: 'שונה',
  szl: 'שלזית',
  mul: 'שפות מרובות',
  th: 'תאית',
  ti: 'תיגרינית',
};

async function handlePage(api: IWikiApi, page: WikiPage) {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    console.error('no content or revid', page.title);
    return null;
  }
  const matches = content.matchAll(regex);
  const matchesArray = Array.from(matches);
  if (!matchesArray.length) {
    console.error(page.title, 'no matches');
    return null;
  }
  let newContent = content;
  for (const match of matchesArray) {
    const [text, hebrewTitle, languageCode, foreignTitle, year, comma] = match;
    const languageName = langugageCodeToLanguageName[languageCode.toLocaleLowerCase()];
    const normalizedForeignTitle = decodeURIComponent(foreignTitle.replace(/_/g, ' '));
    if (languageName) {
      const containsQuotationMarks = !!text.match(/"\[\[([^\]]+)\]\]"/);
      newContent = newContent.replace(text, `{{קישור שפה|${languageName}|${normalizedForeignTitle}|${hebrewTitle}${containsQuotationMarks ? '|מירכאות=כן' : ''}}}${year ? ` <small>${year.replace('</small><small>', '')}</small>` : ''}${comma || ''}`);
    }
  }
  if (newContent !== content) {
    await api.edit(page.title, SUMMARY, newContent, revid);
    return page.title;
  }

  return null;
}

export async function checkPage(api: IWikiApi, title: string) {
  const { content, revid } = await api.articleContent(title);
  const page = convertContentToWikiPage(content, revid, title);
  await handlePage(api, page);
}

export default async function interwikiConverter(api: IWikiApi) {
  const generator = api.search(`insource:/${BASE_SEARCH_PATTERN}/`, false, '0|14|100');
  const converted: string[] = [];
  await asyncGeneratorMapWithSequence(1, generator, (page) => async () => {
    const result = await handlePage(api, page);
    if (result) {
      converted.push(result);
    }
  });
  for (const title of converted) {
    await runSinglePage(title, api);
  }
}
