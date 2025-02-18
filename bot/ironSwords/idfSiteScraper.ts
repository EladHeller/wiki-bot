import { JSDOM } from 'jsdom';
import { Browser, chromium, Page } from 'playwright';

const url = 'https://www.idf.il/אתרי-יחידות/יומן-המלחמה/חללי-ופצועי-צה-ל-במלחמה/';

function getCounter(
  counters: Element[],
  title: string,
  index?: number,
): number | null {
  const elements = counters.filter((counter) => {
    const text = counter.textContent;
    return text?.includes(title);
  });
  if (elements.length > 1 && index == null) {
    throw new Error(`Multiple counters with title ${title}`);
  }
  const element = elements[index ?? 0];
  const numberElement = element?.querySelector('.counters');
  const text = numberElement?.textContent;
  if (!text) {
    throw new Error(`Counter with title ${title} not found`);
  }
  return text ? Number(text.trim().replaceAll(',', '')) : null;
}

export default async function getCasualties() {
  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      timeout: 10 * 1000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    });
    page = await browser.newPage();
    await page.goto(url);
    const content = await page.content();
    const { window } = new JSDOM(content);
    const counters = Array.from(window.document.querySelectorAll('.counter-parent'));
    const soldiersKilled = getCounter(counters, 'חללים מתחילת המלחמה');
    const soldiersKilledManeuver = getCounter(counters, 'חללים מהתמרון בעזה');
    const soldiersWounded = getCounter(counters, 'סה"כ', 0);
    const soldiersWoundedManeuver = getCounter(counters, 'סה"כ', 1);
    return {
      soldiersKilled,
      soldiersKilledManeuver,
      soldiersWounded,
      soldiersWoundedManeuver,
    };
  } finally {
    await page?.close();
    await browser?.close();
  }
}
