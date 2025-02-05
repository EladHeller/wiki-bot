import { chromium } from 'playwright-core';

const codes = ['ab', 'ady', 'udm', 'uz', 'ug', 'os', 'oc', 'uk', 'ur', 'om', 'or', 'az', 'it', 'inh', 'id', 'iu', 'is', 'ga', 'sq', 'als', 'gsw', 'am', 'en', 'simple', 'ang', 'en-ca', 'as', 'et', 'ast', 'af', 'ace', 'an', 'roa-rup', 'arc', 'hy', 'bho', 'bh', 'bg', 'bs', 'bxr', 'my', 'bi', 'bpy', 'be', 'bn', 'eu', 'br', 'ba', 'jv', 'ka', 'zh', 'zh-yue', 'gd', 'gag', 'gaa', 'gn', 'gu', 'got', 'gl', 'kl', 'de', 'nds', 'dz', 'dv', 'da', 'ha', 'ho', 'haw', 'nl', 'hu', 'hif', 'hi', 'war', 'vot', 'vi', 'wa', 'ca', 'cy', 've', 'vec', 'diq', 'zu', 'zea', 'tl', 'tg', 'tyv', 'to', 'tpi', 'tr', 'ota', 'tk', 'tet', 'tt', 'crh', 'bo', 'te', 'ta', 'tn', 'mis', 'mis', 'el', 'grc', 'yo', 'yi', 'ja', 'ku', 'lad', 'lo', 'lg', 'lb', 'lv', 'ltg', 'la', 'liv', 'lij', 'lt', 'li', 'mi', 'mai', 'gv', 'xmf', 'mo', 'mn', 'min', 'mwl', 'ml', 'ms', 'mg', 'mt', 'mk', 'mr', 'mh', 'nv', 'nah', 'na', 'no', 'nn', 'nb', 'new', 'ne', 'nap', 'se', 'ceb', 'sw', 'ss', 'so', 'sd', 'si', 'scn', 'sl', 'sk', 'sm', 'sa', 'st', 'es', 'sco', 'sh', 'sr', 'sc', 'he', 'aa', 'ar', 'arz', 'ary', 'pi', 'pap', 'fo', 'pl', 'pt', 'pt-br', 'fur', 'fj', 'pms', 'fi', 'pcd', 'pa', 'fy', 'frp', 'fa', 'peo', 'ps', 'cv', 'ch', 'ce', 'chr', 'ts', 'fr', 'kn', 'kbd', 'xh', 'ko', 'kw', 'co', 'kk', 'ca', 'ky', 'rn', 'km', 'hr', 'cr', 'ht', 'csb', 'rmy', 'rm', 'ro', 'rue', 'ru', 'sv', 'sn', 'szl', 'mul', 'th', 'ti'];
export default async function visitAllWikis() {
  const browser = await chromium.launch({
    headless: false,
    timeout: 10 * 1000,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  // Go to Hebrew Wikipedia and login
  await page.goto('https://he.wikipedia.org/wiki/מיוחד:כניסה_לחשבון');
  await page.fill('#wpName1', process.env.USER_NAME || '');
  await page.fill('#wpPassword1', process.env.PASSWORD || '');
  await page.click('#wpLoginAttempt');
  await page.waitForLoadState('networkidle');
  for (const code of codes) {
    try {
      const url = `https://${code}.wikipedia.org/`;
      console.log(`Visiting ${url}`);
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.error(`Error visiting ${code}:`, error);
    }
  }

  await browser.close();
}
