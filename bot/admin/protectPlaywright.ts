import playwright from 'playwright';
import readline from 'readline';

let page: playwright.Page;
let browser: playwright.Browser;

export async function loginWithPlaywright(userName: string) {
  browser = await playwright.chromium.launch({
    headless: false,
    timeout: 10 * 1000,
  });
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto('https://he.wikipedia.org/w/index.php?title=%D7%9E%D7%99%D7%95%D7%97%D7%93:%D7%9B%D7%A0%D7%99%D7%A1%D7%94_%D7%9C%D7%97%D7%A9%D7%91%D7%95%D7%9F&returnto=%D7%A2%D7%9E%D7%95%D7%93+%D7%A8%D7%90%D7%A9%D7%99');
  await page.getByPlaceholder('יש להקליד את שם המשתמש').click();
  await page.getByPlaceholder('יש להקליד את שם המשתמש').fill(userName);
  await page.getByPlaceholder('יש להקליד את הסיסמה').click();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const password: string = await new Promise((resolve) => {
    rl.question('Enter password: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
  await page.getByPlaceholder('יש להקליד את הסיסמה').fill(password);
  await page.getByRole('button', { name: 'כניסה לחשבון' }).click();
  await page.waitForLoadState();
  rl.close();
}

export async function protectWithPlaywrihgt(pageName: string) {
  await page.goto(`https://he.wikipedia.org/w/index.php?title=${pageName.replace(/ /g, '_')}&action=protect`);
  const isChecked = await page.getByRole('checkbox', { name: 'שינוי אפשרויות הגנה נוספות' }).isChecked();
  if (isChecked) {
    await page.getByRole('group', { name: 'העברה' }).getByRole('combobox', { name: 'כל המשתמשים מורשים' }).click();
    await page.getByRole('option', { name: 'רק בדוקי עריכות אוטומטית מורשים' }).getByText('רק בדוקי עריכות אוטומטית מורשים').click();
  } else {
    await page.getByRole('group', { name: 'עריכה' }).getByRole('combobox', { name: 'כל המשתמשים מורשים' }).click();
    await page.getByRole('option', { name: 'רק בדוקי עריכות אוטומטית מורשים' }).getByText('רק בדוקי עריכות אוטומטית מורשים').click();
  }
  await page.getByLabel('סיבה אחרת/נוספת:').click();
  await page.getByLabel('סיבה אחרת/נוספת:').fill('מופיע בעמוד הראשי');
  await page.getByRole('button', { name: 'אישור' }).click();
}

export async function closePlaywright() {
  await browser.close();
}
