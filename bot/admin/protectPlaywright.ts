import * as playwright from 'playwright-aws-lambda';
import { ChromiumBrowser, Page } from 'playwright-core';

let page: Page;
let browser: ChromiumBrowser;

export async function loginWithPlaywright(userName: string, password: string) {
  browser = await playwright.launchChromium({
    headless: false,
    timeout: 10 * 1000,
  });
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto('https://he.wikipedia.org/w/index.php?title=%D7%9E%D7%99%D7%95%D7%97%D7%93:%D7%9B%D7%A0%D7%99%D7%A1%D7%94_%D7%9C%D7%97%D7%A9%D7%91%D7%95%D7%9F&returnto=%D7%A2%D7%9E%D7%95%D7%93+%D7%A8%D7%90%D7%A9%D7%99');
  await page.getByPlaceholder('יש להקליד את שם המשתמש').click();
  await page.getByPlaceholder('יש להקליד את שם המשתמש').fill(userName);
  await page.getByPlaceholder('יש להקליד את הסיסמה').click();
  await page.getByPlaceholder('יש להקליד את הסיסמה').fill(password);
  await page.getByRole('button', { name: 'כניסה לחשבון' }).click();
  await page.waitForLoadState();
}

export async function protectWithPlaywrihgt(pageName: string, reason: string) {
  await page.goto(`https://he.wikipedia.org/w/index.php?title=${pageName.replace(/ /g, '_')}&action=protect`);
  const isChecked = await page.getByRole('checkbox', { name: 'שינוי אפשרויות הגנה נוספות' }).isChecked();
  if (isChecked) {
    try {
      await page.getByRole('group', { name: 'העברה' }).getByRole('combobox', { name: 'כל המשתמשים מורשים' }).click({
        timeout: 10 * 1000,
      });
    } catch (e) {
      console.log('try semiprotect');
      await page.getByRole('group', { name: 'העברה' }).getByRole('combobox', { name: 'רק משתמשים ותיקים מורשים' }).click({
        timeout: 10 * 1000,
      });
    }

    await page.getByRole('option', { name: 'רק בדוקי עריכות אוטומטית מורשים' }).getByText('רק בדוקי עריכות אוטומטית מורשים').click();
  } else {
    try {
      await page.getByRole('group', { name: 'עריכה' }).getByRole('combobox', { name: 'כל המשתמשים מורשים' }).click({
        timeout: 10 * 1000,
      });
    } catch (e) {
      console.log('try semiprotect');
      await page.getByRole('group', { name: 'עריכה' }).getByRole('combobox', { name: 'רק משתמשים ותיקים מורשים' }).click({
        timeout: 10 * 1000,
      });
    }

    await page.getByRole('option', { name: 'רק בדוקי עריכות אוטומטית מורשים' }).getByText('רק בדוקי עריכות אוטומטית מורשים').click();
  }
  await page.getByLabel('סיבה אחרת/נוספת:').click();
  await page.getByLabel('סיבה אחרת/נוספת:').fill(reason);
  await page.getByRole('button', { name: 'אישור' }).click();
}

export async function closePlaywright() {
  await browser.close();
}
