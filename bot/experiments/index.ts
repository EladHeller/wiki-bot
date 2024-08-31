import 'dotenv/config';

// eslint-disable-next-line no-empty-function
async function main() {
  const array10 = Array.from({ length: 10 }, (_, i) => i);

  for (const i of array10) {
    console.log(i);
    if (i >= 5) {
      break;
    }
  }
  console.log('done');
}
main();
