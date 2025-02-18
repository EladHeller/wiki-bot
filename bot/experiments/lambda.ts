import { chromium } from 'playwright';

export async function main() {
  const browser = await chromium.launch({
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
  const page = await browser.newPage();
  await page.goto('https://www.example.com');
  console.log(await page.title());
  await browser.close();
}

export default main;
