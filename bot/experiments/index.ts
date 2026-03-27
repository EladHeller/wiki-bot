import { JSDOM } from 'jsdom';

process.env.NODE_ENV = 'development';

// eslint-disable-next-line no-empty-function
async function main() {
  const res = await fetch('https://kineret.org.il/');
  const text = await res.text();
  const dom = new JSDOM(text);
  const element = dom.window.document.querySelector('.hp_miflas_height');
  console.log(element?.textContent);
}
main();
