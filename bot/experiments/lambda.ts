import 'dotenv/config';
import { JSDOM } from 'jsdom';

export async function main() {
  try {
    await JSDOM.fromURL('https://kineret.org.il/');
  } catch (e) {
    console.error(e);
  }
  try {
    await fetch('https://kineret.org.il/');
  } catch (e) {
    console.error(e);
  }
}

export default main;
