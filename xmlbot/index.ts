import WikiApi from '../bot/wiki/WikiApi';

console.debug = () => { }

async function main() {
  const api = WikiApi();
  await api.login()
}

main();