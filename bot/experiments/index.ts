import 'dotenv/config';
import { isTwoWordsIsTheSamePerson } from '../API/openai';

async function main() {
  const questions = [
    ['[[עפרה שטראוס]]', 'ד״ר עופרה שטראוס'],
    ['[[מיכה מייקסנר]]', 'מיכאל מייקסנר'],
    ['[[דינה בן טל גננסיה]]', 'דינה גננסיה בן טל'],
    ['[[מאיר שפיגלר]]', 'שפיגלר בן אורי מאיר'],
    ['איתי בן זאב', 'בן זאב איתי'],
    ['שלומי טחן', 'שלמה טחן'],
    ['משה אביגדור כהן', 'משה אביגדור לוי'],
    ['[[חנן פרידמן]]', 'פרידמן חנן שמואל'],
    ['[[סמדר ברבר-צדיק]]', 'סמדר ברבר-צדיק'],
    ['[[הראל ויזל]]', 'ויזל הראל אליעזר'],
    ['[[עידן וולס]]', 'עידן ולס'],
  ];
  for (const q of questions) {
    const [nameFromWiki, name2] = q;
    const curr = await isTwoWordsIsTheSamePerson(nameFromWiki, name2);
    console.log(q, curr);
  }
}

main();
