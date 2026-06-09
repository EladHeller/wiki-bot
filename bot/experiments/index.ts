import WikiApi from '../wiki/WikiApi';

process.env.NODE_ENV = 'development';

// eslint-disable-next-line no-empty-function
async function main() {
  const api = WikiApi();
  await api.login();
  await api.purge(['קטגוריה:קישור לערך לא קיים בוויקיפדיה זרה']);
}
main();
